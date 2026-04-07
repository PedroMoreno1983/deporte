from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, timedelta
from ....core.database import get_db
from ....core.deps import get_current_user
from ....models.player import Player, PlayerStatus
from ....models.injury import Injury
from ....models.match import MatchStat, Match
from ....models.training import TrainingSession

router = APIRouter()


@router.get("/dashboard")
def get_dashboard(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """KPIs principales del dashboard."""
    q = db.query(Player).filter(Player.is_active == True)
    if category_id:
        q = q.filter(Player.category_id == category_id)
    players = q.all()
    total = len(players)

    by_status = {}
    for p in players:
        by_status[p.status.value] = by_status.get(p.status.value, 0) + 1

    available = by_status.get("available", 0)
    injured = by_status.get("injured", 0)
    availability_rate = round(available / total * 100, 1) if total > 0 else 0

    # Lesiones activas
    active_injuries = db.query(Injury).filter(Injury.is_recovered == False).count()

    # Partidos último mes
    last_month = date.today() - timedelta(days=30)
    recent_matches = db.query(Match).filter(Match.date >= last_month).count()

    # Promedio calificación equipo
    avg_rating = (
        db.query(func.avg(MatchStat.rating))
        .filter(MatchStat.rating.isnot(None))
        .scalar()
    )

    return {
        "total_players": total,
        "available": available,
        "injured": injured,
        "recovering": by_status.get("recovering", 0),
        "suspended": by_status.get("suspended", 0),
        "availability_rate": availability_rate,
        "active_injuries": active_injuries,
        "recent_matches": recent_matches,
        "avg_team_rating": round(float(avg_rating), 2) if avg_rating else None,
        "by_status": by_status,
    }


@router.get("/player/{player_id}/summary")
def get_player_summary(player_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Resumen analítico completo de un jugador."""
    # Promedio de stats en partidos
    stats = db.query(MatchStat).filter(MatchStat.player_id == player_id).all()
    if not stats:
        return {"player_id": player_id, "matches": 0}

    total_matches = len(stats)
    started = sum(1 for s in stats if s.started)
    total_minutes = sum(s.minutes_played for s in stats)
    total_goals = sum(s.goals for s in stats)
    total_assists = sum(s.assists for s in stats)
    avg_rating = sum(s.rating for s in stats if s.rating) / max(sum(1 for s in stats if s.rating), 1)
    avg_distance = sum(s.total_distance_m for s in stats if s.total_distance_m) / max(
        sum(1 for s in stats if s.total_distance_m), 1
    )

    # Injuries count
    total_injuries = db.query(Injury).filter(Injury.player_id == player_id).count()

    # Training load last 7 days
    cutoff = date.today() - timedelta(days=7)
    weekly_sessions = (
        db.query(TrainingSession)
        .filter(TrainingSession.player_id == player_id, TrainingSession.session_date >= cutoff)
        .all()
    )
    weekly_load = sum(s.session_load for s in weekly_sessions if s.session_load)

    return {
        "player_id": player_id,
        "matches": total_matches,
        "started": started,
        "total_minutes": total_minutes,
        "goals": total_goals,
        "assists": total_assists,
        "goal_contributions": total_goals + total_assists,
        "avg_rating": round(avg_rating, 2),
        "avg_distance_m": round(avg_distance, 1),
        "total_injuries": total_injuries,
        "weekly_load": round(weekly_load, 1),
    }


@router.get("/injuries/stats")
def get_injury_stats(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Estadísticas de lesiones del equipo."""
    from sqlalchemy import extract
    injuries = db.query(Injury).all()
    if not injuries:
        return {"total": 0}

    by_zone = {}
    by_severity = {}
    by_mechanism = {}
    by_month = {}

    for inj in injuries:
        zone = inj.body_zone.value
        by_zone[zone] = by_zone.get(zone, 0) + 1

        sev = inj.severity.value
        by_severity[sev] = by_severity.get(sev, 0) + 1

        mech = inj.mechanism.value
        by_mechanism[mech] = by_mechanism.get(mech, 0) + 1

        month_key = inj.injury_date.strftime("%Y-%m")
        by_month[month_key] = by_month.get(month_key, 0) + 1

    avg_days = sum(inj.actual_days_out for inj in injuries if inj.actual_days_out) / max(
        sum(1 for inj in injuries if inj.actual_days_out), 1
    )

    return {
        "total": len(injuries),
        "active": sum(1 for inj in injuries if not inj.is_recovered),
        "avg_days_out": round(avg_days, 1),
        "by_zone": by_zone,
        "by_severity": by_severity,
        "by_mechanism": by_mechanism,
        "by_month": dict(sorted(by_month.items())),
    }


def _player_radar(player_id: int, db: Session) -> dict:
    """Compute normalised radar metrics (0-100) for a single player."""
    stats = db.query(MatchStat).filter(MatchStat.player_id == player_id).all()
    matches = len(stats)
    if matches == 0:
        return {"rendimiento": 0, "goles": 0, "asistencias": 0,
                "minutos": 0, "distancia": 0, "carga": 0}

    avg_rating   = sum(s.rating or 0 for s in stats) / max(sum(1 for s in stats if s.rating), 1)
    goals_p90    = (sum(s.goals for s in stats) / max(sum(s.minutes_played for s in stats), 1)) * 90
    assists_p90  = (sum(s.assists for s in stats) / max(sum(s.minutes_played for s in stats), 1)) * 90
    avg_minutes  = sum(s.minutes_played for s in stats) / matches
    avg_distance = sum(s.total_distance_m or 0 for s in stats) / matches

    cutoff = date.today() - timedelta(days=7)
    weekly_sessions = (
        db.query(TrainingSession)
        .filter(TrainingSession.player_id == player_id, TrainingSession.session_date >= cutoff)
        .all()
    )
    weekly_load = sum(s.session_load or 0 for s in weekly_sessions)

    return {
        "rendimiento": min(round(avg_rating * 10, 1), 100),
        "goles":       min(round(goals_p90 * 50, 1), 100),
        "asistencias": min(round(assists_p90 * 50, 1), 100),
        "minutos":     min(round(avg_minutes / 90 * 100, 1), 100),
        "distancia":   min(round(avg_distance / 10000 * 100, 1), 100),
        "carga":       min(round(weekly_load / 5 * 100, 1), 100),
    }


@router.get("/player/{player_id}/radar")
def get_player_radar(
    player_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Radar metrics for a player vs team average."""
    radar = _player_radar(player_id, db)

    # Team average
    all_players = db.query(Player).filter(Player.is_active == True).all()
    team_radars = [_player_radar(p.id, db) for p in all_players if p.id != player_id]

    if team_radars:
        keys = list(radar.keys())
        team_avg = {k: round(sum(r[k] for r in team_radars) / len(team_radars), 1) for k in keys}
    else:
        team_avg = {k: 0 for k in radar}

    return {"player": radar, "team_avg": team_avg}


@router.get("/team/radar")
def get_team_radar(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Radar + summary for all players (for comparison table)."""
    q = db.query(Player).filter(Player.is_active == True)
    if category_id:
        q = q.filter(Player.category_id == category_id)
    players = q.all()

    result = []
    for p in players:
        r = _player_radar(p.id, db)
        r["player_id"]   = p.id
        r["player_name"] = p.full_name
        r["position"]    = p.position.value if p.position else ""
        r["jersey"]      = p.jersey_number
        r["status"]      = p.status.value if p.status else ""
        result.append(r)

    return result
