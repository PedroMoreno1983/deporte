from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, timedelta

from ....core.database import get_db
from ....core.deps import get_current_user, require_roles, scoped_query, get_player_in_club
from ....models.wellness import WellnessEntry
from ....models.player import Player, PlayerStatus
from ....models.user import User, UserRole
from ....schemas.wellness import WellnessCreate, WellnessOut, WellnessTeamSummary, WellnessTeamEntry
from ....websockets import manager, RealtimeEvent

router = APIRouter()

ALERT_THRESHOLD = 5  # Score <= este valor → alerta


def calc_score(sleep: int, fatigue: int, mood: int, soreness: int, stress: int) -> float:
    """Score compuesto ponderado (1-10). Mayor = mejor estado."""
    return round(
        sleep    * 0.25 +
        fatigue  * 0.25 +
        mood     * 0.20 +
        soreness * 0.15 +
        stress   * 0.15,
        2
    )


# ── Crear / actualizar entrada diaria ─────────────────────────────────────────
@router.post("/", response_model=WellnessOut, status_code=status.HTTP_201_CREATED)
def create_wellness(
    data: WellnessCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.KINESIOLOGIST)),
):
    # Upsert: si ya existe entrada para ese jugador y fecha, actualiza
    existing = db.query(WellnessEntry).filter(
        and_(WellnessEntry.player_id == data.player_id,
             WellnessEntry.entry_date == data.entry_date)
    ).first()

    score = calc_score(data.sleep_quality, data.fatigue, data.mood, data.muscle_soreness, data.stress)

    if existing:
        for k, v in data.model_dump().items():
            setattr(existing, k, v)
        existing.wellness_score = score
        db.commit()
        db.refresh(existing)
        _broadcast_wellness(existing, score, updated=True)
        return existing

    entry = WellnessEntry(**data.model_dump(), wellness_score=score)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    _broadcast_wellness(entry, score, updated=False)
    return entry


def _broadcast_wellness(entry: "WellnessEntry", score: float, *, updated: bool) -> None:
    """Push wellness update + alert if below threshold."""
    manager.publish_sync(RealtimeEvent(
        topic="wellness",
        type="wellness.updated" if updated else "wellness.created",
        payload={
            "entry_id":   entry.id,
            "player_id":  entry.player_id,
            "entry_date": str(entry.entry_date),
            "score":      score,
        },
    ))
    if score <= ALERT_THRESHOLD:
        manager.publish_sync(RealtimeEvent(
            topic="notifications",
            type="notification.new",
            payload={"kind": "wellness_bajo", "player_id": entry.player_id, "score": score},
        ))


# ── Historial de un jugador ────────────────────────────────────────────────────
@router.get("/player/{player_id}", response_model=List[WellnessOut])
def get_player_wellness(
    player_id: int,
    days: int = Query(30, ge=7, le=180),
    db: Session = Depends(get_db),
    _player=Depends(get_player_in_club),
):
    since = date.today() - timedelta(days=days)
    return (
        db.query(WellnessEntry)
        .filter(
            WellnessEntry.player_id == player_id,
            WellnessEntry.entry_date >= since,
        )
        .order_by(WellnessEntry.entry_date.asc())
        .all()
    )


# ── Resumen del equipo para una fecha ─────────────────────────────────────────
@router.get("/team/summary", response_model=WellnessTeamSummary)
def get_team_summary(
    target_date: Optional[date] = Query(None, description="Fecha (default: hoy)"),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if target_date is None:
        target_date = date.today()

    # Jugadores activos (del club del usuario)
    q = scoped_query(db.query(Player), Player, current_user).filter(Player.status != PlayerStatus.INACTIVE)
    if category_id:
        q = q.filter(Player.category_id == category_id)
    players = q.order_by(Player.last_name, Player.first_name).all()  # full_name is a @property, not sortable

    # Entradas del día
    entries_today = {
        e.player_id: e
        for e in db.query(WellnessEntry)
        .filter(WellnessEntry.entry_date == target_date)
        .all()
    }

    team_entries: List[WellnessTeamEntry] = []
    scores = []

    for p in players:
        entry = entries_today.get(p.id)
        has   = entry is not None
        score = entry.wellness_score if has else None
        alert = bool(score and score <= ALERT_THRESHOLD)

        if score:
            scores.append(score)

        team_entries.append(WellnessTeamEntry(
            player_id       = p.id,
            player_name     = p.full_name,
            jersey_number   = p.jersey_number,
            wellness_score  = score,
            sleep_quality   = entry.sleep_quality   if has else None,
            fatigue         = entry.fatigue          if has else None,
            mood            = entry.mood             if has else None,
            muscle_soreness = entry.muscle_soreness  if has else None,
            stress          = entry.stress           if has else None,
            rpe_post        = entry.rpe_post         if has else None,
            has_entry       = has,
            alert           = alert,
        ))

    avg_score = round(sum(scores) / len(scores), 2) if scores else None
    alerts    = sum(1 for e in team_entries if e.alert)

    return WellnessTeamSummary(
        date           = target_date,
        total_players  = len(players),
        responded      = len(entries_today),
        avg_score      = avg_score,
        alerts         = alerts,
        entries        = team_entries,
    )


# ── Tendencia del equipo (últimos N días) ──────────────────────────────────────
@router.get("/team/trend")
def get_team_trend(
    days: int = Query(14, ge=7, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = date.today() - timedelta(days=days)
    # WellnessEntry has no club_id; scope by the club's players.
    player_ids = [p.id for p in scoped_query(db.query(Player.id), Player, current_user).all()]
    entries = (
        db.query(WellnessEntry)
        .filter(WellnessEntry.entry_date >= since, WellnessEntry.player_id.in_(player_ids))
        .order_by(WellnessEntry.entry_date.asc())
        .all()
    )

    # Agrupar por fecha
    by_date: dict = {}
    for e in entries:
        key = str(e.entry_date)
        if key not in by_date:
            by_date[key] = []
        if e.wellness_score:
            by_date[key].append(e.wellness_score)

    trend = [
        {
            "date":        d,
            "avg_score":   round(sum(v) / len(v), 2) if v else None,
            "count":       len(v),
        }
        for d, v in sorted(by_date.items())
    ]
    return trend
