from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.player import Player
from app.models.injury import Injury
from app.models.prediction import PredictionScore
from app.models.wellness import WellnessEntry
from datetime import date, timedelta
from typing import Any, Dict, List
from pydantic import BaseModel

router = APIRouter()


class DeviceTokenIn(BaseModel):
    token:    str
    platform: str  # "ios" | "android" | "web"


@router.post("/device-token")
def register_device_token(
    body: DeviceTokenIn,
    current_user=Depends(get_current_user),
):
    """Register the current device for push notifications.
    Currently logs the token in memory; persist to a DeviceToken model when ready."""
    import logging
    logging.getLogger("push").info(
        "device token registered user=%s platform=%s token=%s",
        current_user.id, body.platform, body.token[:32] + "...",
    )
    return {"ok": True, "user_id": current_user.id, "platform": body.platform}


def _wellness_score(w: WellnessEntry) -> int:
    """Compute 0-100 wellness score from entry fields."""
    if w.wellness_score is not None:
        return int(round(w.wellness_score))
    components = [
        w.sleep_quality or 5,
        w.fatigue or 5,
        w.mood or 5,
        w.muscle_soreness or 5,
        10 - (w.stress or 5),
    ]
    return int(round(sum(components) / len(components) * 10))


@router.get("/", response_model=List[Dict[str, Any]])
def get_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    alerts: List[Dict[str, Any]] = []

    # ── 1. Active injuries ──────────────────────────────────
    active_injuries = (
        db.query(Injury)
        .filter(Injury.is_recovered == False)
        .order_by(desc(Injury.injury_date))
        .all()
    )
    for inj in active_injuries:
        player = db.query(Player).filter(Player.id == inj.player_id).first()
        name = f"{player.first_name} {player.last_name}" if player else f"Jugador #{inj.player_id}"
        severity_val = str(inj.severity.value) if hasattr(inj.severity, "value") else str(inj.severity)
        sev = "alta" if severity_val in ("grade_3", "grade_4") else "media"
        alerts.append({
            "id": f"injury_{inj.id}",
            "type": "lesion_activa",
            "severity": sev,
            "title": "Lesión activa",
            "message": f"{name} — {inj.injury_type}",
            "player_id": inj.player_id,
            "player_name": name,
            "date": str(inj.injury_date),
        })

    # ── 2. Low wellness (last 3 days, score < 55) ───────────
    cutoff = date.today() - timedelta(days=3)
    # latest entry per player in window
    latest_sub = (
        db.query(
            WellnessEntry.player_id,
            func.max(WellnessEntry.entry_date).label("max_date"),
        )
        .filter(WellnessEntry.entry_date >= cutoff)
        .group_by(WellnessEntry.player_id)
        .subquery()
    )
    recent_wellness = (
        db.query(WellnessEntry)
        .join(
            latest_sub,
            (WellnessEntry.player_id == latest_sub.c.player_id)
            & (WellnessEntry.entry_date == latest_sub.c.max_date),
        )
        .all()
    )
    for w in recent_wellness:
        score = _wellness_score(w)
        if score < 55:
            player = db.query(Player).filter(Player.id == w.player_id).first()
            name = f"{player.first_name} {player.last_name}" if player else f"Jugador #{w.player_id}"
            sev = "critica" if score < 35 else "alta" if score < 45 else "media"
            alerts.append({
                "id": f"wellness_{w.id}",
                "type": "wellness_bajo",
                "severity": sev,
                "title": "Wellness bajo",
                "message": f"{name} — {score}/100",
                "player_id": w.player_id,
                "player_name": name,
                "date": str(w.entry_date),
            })

    # ── 3. High / critical injury risk ─────────────────────
    # Latest prediction per player
    latest_pred_sub = (
        db.query(
            PredictionScore.player_id,
            func.max(PredictionScore.calculated_at).label("max_calc"),
        )
        .group_by(PredictionScore.player_id)
        .subquery()
    )
    high_risk_preds = (
        db.query(PredictionScore)
        .join(
            latest_pred_sub,
            (PredictionScore.player_id == latest_pred_sub.c.player_id)
            & (PredictionScore.calculated_at == latest_pred_sub.c.max_calc),
        )
        .filter(PredictionScore.injury_risk_level.in_(["high", "critical"]))
        .all()
    )
    for pred in high_risk_preds:
        player = db.query(Player).filter(Player.id == pred.player_id).first()
        name = f"{player.first_name} {player.last_name}" if player else f"Jugador #{pred.player_id}"
        sev = "critica" if pred.injury_risk_level == "critical" else "alta"
        score_pct = int(round((pred.injury_risk_score or 0)))
        alerts.append({
            "id": f"risk_{pred.id}",
            "type": "riesgo_alto",
            "severity": sev,
            "title": "Riesgo de lesión elevado",
            "message": f"{name} — {score_pct}% riesgo",
            "player_id": pred.player_id,
            "player_name": name,
            "date": str(pred.calculated_at)[:10] if pred.calculated_at else "",
        })

    # Sort: critica > alta > media > baja
    order = {"critica": 0, "alta": 1, "media": 2, "baja": 3}
    alerts.sort(key=lambda a: order.get(a["severity"], 9))

    return alerts
