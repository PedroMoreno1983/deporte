from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, timedelta
from ....core.database import get_db
from ....core.deps import get_current_user, scoped_query, get_player_in_club
from ....models.player import Player, PlayerStatus
from ....models.injury import Injury
from ....models.match import MatchStat, Match
from ....models.training import TrainingSession
from ....models.user import User

router = APIRouter()


def _club_player_ids(db: Session, current_user: User) -> list[int]:
    """Ids of the players in the caller's club — used to scope per-player
    aggregates (Injury, MatchStat…) whose own models have no club_id."""
    return [pid for (pid,) in scoped_query(db.query(Player.id), Player, current_user).all()]


@router.get("/dashboard")
def get_dashboard(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """KPIs principales del dashboard (del club del usuario)."""
    q = scoped_query(db.query(Player), Player, current_user).filter(Player.is_active == True)
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

    club_player_ids = [p.id for p in players]

    # Lesiones activas (de jugadores del club)
    active_injuries = db.query(Injury).filter(
        Injury.is_recovered == False, Injury.player_id.in_(club_player_ids)
    ).count()

    # Partidos último mes (del club)
    last_month = date.today() - timedelta(days=30)
    recent_matches = scoped_query(db.query(Match), Match, current_user).filter(
        Match.date >= last_month
    ).count()

    # Promedio calificación equipo (jugadores del club)
    avg_rating = (
        db.query(func.avg(MatchStat.rating))
        .filter(MatchStat.rating.isnot(None), MatchStat.player_id.in_(club_player_ids))
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
def get_player_summary(player_id: int, db: Session = Depends(get_db), _player=Depends(get_player_in_club)):
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
def get_injury_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Estadísticas de lesiones del equipo (del club del usuario)."""
    injuries = db.query(Injury).filter(
        Injury.player_id.in_(_club_player_ids(db, current_user))
    ).all()
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
    current_user: User = Depends(get_current_user),
    _player=Depends(get_player_in_club),
):
    """Radar metrics for a player vs team average."""
    radar = _player_radar(player_id, db)

    # Team average (current club only)
    all_players = scoped_query(db.query(Player), Player, current_user).filter(Player.is_active == True).all()
    team_radars = [_player_radar(p.id, db) for p in all_players if p.id != player_id]

    if team_radars:
        keys = list(radar.keys())
        team_avg = {k: round(sum(r[k] for r in team_radars) / len(team_radars), 1) for k in keys}
    else:
        team_avg = {k: 0 for k in radar}

    return {"player": radar, "team_avg": team_avg}


def _percentile(value: float, dataset: list[float]) -> float:
    """Return the percentile of `value` within `dataset` (0..100)."""
    if not dataset:
        return 0.0
    n = len(dataset)
    below = sum(1 for v in dataset if v < value)
    equal = sum(1 for v in dataset if v == value)
    # Standard percentile-rank with adjustment for ties
    return round(((below + 0.5 * equal) / n) * 100, 1)


def _league_label(p: float) -> str:
    if p >= 90: return "Élite (top 10%)"
    if p >= 75: return "Por encima del promedio"
    if p >= 50: return "En el promedio"
    if p >= 25: return "Por debajo del promedio"
    return "Cola inferior"


@router.get("/player/{player_id}/benchmarks")
def get_player_benchmarks(
    player_id: int,
    db: Session = Depends(get_db),
    _player=Depends(get_player_in_club),
):
    """Compare a player against same-position peers (proxy league benchmark).

    Returns per-metric: player value, peer average, percentile and label.
    Currently peers = active players in the same position across all available
    data (cross-club for super-admin, otherwise scoped via Player.club_id).
    """
    target = db.query(Player).filter(Player.id == player_id).first()
    if not target:
        return {"error": "player not found"}

    # Peers: same position, active
    peer_q = db.query(Player).filter(Player.is_active == True, Player.position == target.position)
    if not _has_superadmin_attr_or_default(target):
        # Scope to same club for non-superadmin contexts
        peer_q = peer_q.filter(Player.club_id == target.club_id)
    peers = peer_q.all()
    peer_ids = [p.id for p in peers]

    def _metrics_for(pid: int) -> dict:
        # Aggregate this player's metrics from match_stats
        agg = (
            db.query(
                func.coalesce(func.sum(MatchStat.minutes_played), 0).label("minutes"),
                func.coalesce(func.sum(MatchStat.goals), 0).label("goals"),
                func.coalesce(func.sum(MatchStat.assists), 0).label("assists"),
                func.coalesce(func.avg(MatchStat.rating), 0).label("avg_rating"),
                func.coalesce(func.sum(MatchStat.total_distance_m), 0).label("distance"),
                func.coalesce(func.sum(MatchStat.tackles), 0).label("tackles"),
                func.coalesce(func.sum(MatchStat.key_passes), 0).label("key_passes"),
                func.count(MatchStat.id).label("matches"),
            )
            .filter(MatchStat.player_id == pid)
            .first()
        )
        matches = (agg.matches or 0) if agg else 0
        if matches == 0:
            return {"goals_per90": 0.0, "assists_per90": 0.0, "avg_rating": 0.0, "distance_per_match": 0.0, "tackles_per_match": 0.0, "key_passes_per_match": 0.0}
        minutes = max(agg.minutes or 1, 1)
        return {
            "goals_per90":          (agg.goals    or 0) / minutes * 90,
            "assists_per90":        (agg.assists  or 0) / minutes * 90,
            "avg_rating":           float(agg.avg_rating or 0),
            "distance_per_match":   (agg.distance or 0) / matches,
            "tackles_per_match":    (agg.tackles  or 0) / matches,
            "key_passes_per_match": (agg.key_passes or 0) / matches,
        }

    target_metrics = _metrics_for(target.id)
    peer_metrics_all = [_metrics_for(pid) for pid in peer_ids if pid != target.id]

    METRIC_LABELS = {
        "goals_per90":          "Goles / 90 min",
        "assists_per90":        "Asistencias / 90 min",
        "avg_rating":           "Rating promedio",
        "distance_per_match":   "Distancia / partido (m)",
        "tackles_per_match":    "Entradas / partido",
        "key_passes_per_match": "Pases clave / partido",
    }

    benchmarks = []
    for key, label in METRIC_LABELS.items():
        peer_values = [m[key] for m in peer_metrics_all]
        avg = (sum(peer_values) / len(peer_values)) if peer_values else 0
        p = _percentile(target_metrics[key], peer_values) if peer_values else 0
        benchmarks.append({
            "metric":     key,
            "label":      label,
            "value":      round(target_metrics[key], 2),
            "peer_avg":   round(avg, 2),
            "percentile": p,
            "level":      _league_label(p),
            "peer_count": len(peer_values),
        })

    return {
        "player_id":   target.id,
        "position":    target.position.value if target.position else None,
        "benchmarks":  benchmarks,
    }


def _has_superadmin_attr_or_default(p) -> bool:
    # Placeholder hook: in this endpoint we don't have current_user, so we
    # always scope to the player's club_id (safer default).
    return False


@router.get("/team/radar")
def get_team_radar(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Radar + summary for all players (current club only)."""
    q = scoped_query(db.query(Player), Player, current_user).filter(Player.is_active == True)
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
