"""
Load-management recommendations.

Rule-based system grounded in sports-science literature (ACWR + recent injury +
upcoming match). Returns per-player suggested action for the next training
microcycle (this week → next match).

Each recommendation has:
  - `action`:     short imperative ("Reducir carga 20%", "Sesión recovery", …)
  - `reason`:     plain-Spanish justification
  - `priority`:   "high" | "medium" | "low"
  - `metrics`:    snapshot of inputs (ACWR, weekly_load, last_injury_days)

The same explanation framework as injury_risk.py applies — coaches can audit
why every recommendation was issued.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..models.injury import Injury
from ..models.player import Player, PlayerStatus
from ..models.training import TrainingSession


# ── Tunables ─────────────────────────────────────────────────────────
ACWR_SAFE_LOW       = 0.8
ACWR_SAFE_HIGH      = 1.3
ACWR_WARNING_HIGH   = 1.5
WEEKLY_LOAD_HIGH    = 3000
WEEKLY_LOAD_VERY_HIGH = 4000
RECENT_INJURY_DAYS  = 45


@dataclass
class LoadRec:
    player_id: int
    player_name: str
    action: str
    reason: str
    priority: str          # high | medium | low
    metrics: Dict[str, Any] = field(default_factory=dict)


def _recent_load_metrics(db: Session, player_id: int) -> Dict[str, Optional[float]]:
    today = date.today()
    last = (
        db.query(TrainingSession)
        .filter(TrainingSession.player_id == player_id, TrainingSession.acwr.isnot(None))
        .order_by(TrainingSession.session_date.desc())
        .first()
    )
    sessions_7d = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.player_id == player_id,
            TrainingSession.session_date >= today - timedelta(days=7),
            TrainingSession.session_load.isnot(None),
        )
        .all()
    )
    weekly_load = sum((s.session_load or 0) for s in sessions_7d) or 0
    return {
        "acwr":         last.acwr if last else None,
        "weekly_load":  round(weekly_load, 1),
        "sessions_7d":  len(sessions_7d),
    }


def _days_since_last_injury(db: Session, player_id: int) -> Optional[int]:
    last = (
        db.query(Injury)
        .filter(Injury.player_id == player_id)
        .order_by(Injury.injury_date.desc())
        .first()
    )
    if not last:
        return None
    return (date.today() - last.injury_date).days


def recommend_for_player(player: Player, db: Session) -> Optional[LoadRec]:
    """Return a recommendation, or None when the player is in the optimal zone."""
    metrics = _recent_load_metrics(db, player.id)
    last_inj = _days_since_last_injury(db, player.id)
    metrics["last_injury_days"] = last_inj

    # Players who are injured / inactive don't get load recommendations
    if player.status in (PlayerStatus.INJURED, PlayerStatus.INACTIVE, PlayerStatus.SUSPENDED):
        return None

    acwr = metrics["acwr"]
    weekly_load = metrics["weekly_load"] or 0

    # ── Priority 1: returning from injury within 45 days ─────────────
    if last_inj is not None and last_inj < RECENT_INJURY_DAYS:
        return LoadRec(
            player_id=player.id,
            player_name=player.full_name,
            action=f"Carga progresiva — solo {min(60 + last_inj, 100)}% de carga normal",
            reason=(
                f"Reintegro tras lesión hace {last_inj} días. "
                "Aplicar progresión de carga para evitar recidiva."
            ),
            priority="high",
            metrics=metrics,
        )

    # ── Priority 1: very high ACWR (spike) ───────────────────────────
    if acwr is not None and acwr > ACWR_WARNING_HIGH:
        return LoadRec(
            player_id=player.id,
            player_name=player.full_name,
            action="Reducir carga 20-30% esta semana",
            reason=(
                f"ACWR de {acwr:.2f} indica un pico de carga frente al promedio crónico. "
                "Reducir intensidad para volver a la zona segura (<1.3)."
            ),
            priority="high",
            metrics=metrics,
        )

    # ── Priority 2: high ACWR (warning zone) ─────────────────────────
    if acwr is not None and acwr > ACWR_SAFE_HIGH:
        return LoadRec(
            player_id=player.id,
            player_name=player.full_name,
            action="Mantener carga, evitar incrementos",
            reason=(
                f"ACWR de {acwr:.2f} está en zona de advertencia. "
                "Estable o leve disminución; evitar duplicar sesiones intensas."
            ),
            priority="medium",
            metrics=metrics,
        )

    # ── Priority 2: weekly load too high ─────────────────────────────
    if weekly_load > WEEKLY_LOAD_VERY_HIGH:
        return LoadRec(
            player_id=player.id,
            player_name=player.full_name,
            action="Sesión de recovery + reducir 1 entrenamiento",
            reason=f"Carga semanal de {weekly_load:.0f} UA muy elevada (>4000).",
            priority="high",
            metrics=metrics,
        )
    if weekly_load > WEEKLY_LOAD_HIGH:
        return LoadRec(
            player_id=player.id,
            player_name=player.full_name,
            action="Una sesión de baja intensidad esta semana",
            reason=f"Carga semanal de {weekly_load:.0f} UA en rango alto (>3000).",
            priority="medium",
            metrics=metrics,
        )

    # ── Sub-load: undertrained ───────────────────────────────────────
    if acwr is not None and acwr < ACWR_SAFE_LOW:
        return LoadRec(
            player_id=player.id,
            player_name=player.full_name,
            action="Incrementar carga progresivamente",
            reason=(
                f"ACWR de {acwr:.2f} sugiere sub-entrenamiento. "
                "Volver al volumen habitual evita descondicionamiento."
            ),
            priority="low",
            metrics=metrics,
        )

    # Optimal — no recommendation needed
    return None


def recommend_team(db: Session, club_id: Optional[int] = None) -> List[Dict[str, Any]]:
    q = db.query(Player).filter(Player.is_active == True)
    if club_id is not None:
        q = q.filter(Player.club_id == club_id)
    recs: List[LoadRec] = []
    for p in q.all():
        r = recommend_for_player(p, db)
        if r:
            recs.append(r)
    # Sort by priority then by action urgency
    order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: (order.get(r.priority, 9), r.player_name))
    return [r.__dict__ for r in recs]
