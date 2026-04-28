"""
POST /alerts/send — triggers email alerts for critical risk / low wellness / active injuries.
Only admins & coaches can trigger it.
Also exposes GET /alerts/preview to see what would be sent without actually sending.
"""
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Any, Dict, List

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.player import Player
from app.models.injury import Injury
from app.models.prediction import PredictionScore
from app.models.wellness import WellnessEntry
from app.models.user import User, UserRole
from app.core.email import send_bulk_alert
from app.core.config import settings
from datetime import date, timedelta

router = APIRouter()

SEV_COLORS = {"critica": "#ff3b30", "alta": "#f97316", "media": "#f59e0b", "baja": "#00c96a"}


def _wellness_score(w: WellnessEntry) -> int:
    if w.wellness_score is not None:
        return int(round(w.wellness_score))
    components = [w.sleep_quality or 5, w.fatigue or 5, w.mood or 5,
                  w.muscle_soreness or 5, 10 - (w.stress or 5)]
    return int(round(sum(components) / len(components) * 10))


def _build_alert_sections(db: Session):
    sections = []

    # ── Active injuries ──────────────────────────────────
    active = db.query(Injury).filter(Injury.is_recovered == False).all()
    if active:
        items = []
        for inj in active:
            p = db.query(Player).filter(Player.id == inj.player_id).first()
            name = f"{p.first_name} {p.last_name}" if p else f"Jugador #{inj.player_id}"
            sev = str(inj.severity.value) if hasattr(inj.severity, "value") else str(inj.severity)
            color = "#ff3b30" if sev in ("grade_3", "grade_4") else "#f59e0b"
            items.append({
                "label": f"{name} — {inj.injury_type}",
                "value": sev.replace("grade_", "Grado ") + f" · {inj.injury_date}",
                "color": color,
            })
        sections.append({"title": f"Lesiones Activas ({len(active)})", "color": "#ff3b30", "items": items})

    # ── Low wellness (last 3 days) ───────────────────────
    cutoff = date.today() - timedelta(days=3)
    latest_sub = (
        db.query(WellnessEntry.player_id, func.max(WellnessEntry.entry_date).label("max_date"))
        .filter(WellnessEntry.entry_date >= cutoff)
        .group_by(WellnessEntry.player_id).subquery()
    )
    recent = (
        db.query(WellnessEntry)
        .join(latest_sub, (WellnessEntry.player_id == latest_sub.c.player_id)
              & (WellnessEntry.entry_date == latest_sub.c.max_date))
        .all()
    )
    low_wellness = [(w, _wellness_score(w)) for w in recent if _wellness_score(w) < 55]
    if low_wellness:
        items = []
        for w, score in sorted(low_wellness, key=lambda x: x[1]):
            p = db.query(Player).filter(Player.id == w.player_id).first()
            name = f"{p.first_name} {p.last_name}" if p else f"Jugador #{w.player_id}"
            color = "#ff3b30" if score < 35 else "#f97316" if score < 45 else "#f59e0b"
            items.append({"label": name, "value": f"{score}/100 · {w.entry_date}", "color": color})
        sections.append({"title": f"Wellness Bajo ({len(low_wellness)} jugadores)", "color": "#f59e0b", "items": items})

    # ── High/critical injury risk ───────────────────────
    latest_pred_sub = (
        db.query(PredictionScore.player_id, func.max(PredictionScore.calculated_at).label("max_calc"))
        .group_by(PredictionScore.player_id).subquery()
    )
    high_risk = (
        db.query(PredictionScore)
        .join(latest_pred_sub, (PredictionScore.player_id == latest_pred_sub.c.player_id)
              & (PredictionScore.calculated_at == latest_pred_sub.c.max_calc))
        .filter(PredictionScore.injury_risk_level.in_(["high", "critical"]))
        .all()
    )
    if high_risk:
        items = []
        for pred in sorted(high_risk, key=lambda x: -(x.injury_risk_score or 0)):
            p = db.query(Player).filter(Player.id == pred.player_id).first()
            name = f"{p.first_name} {p.last_name}" if p else f"Jugador #{pred.player_id}"
            color = "#ff3b30" if pred.injury_risk_level == "critical" else "#f97316"
            items.append({
                "label": name,
                "value": f"{int(pred.injury_risk_score or 0)}% riesgo · {pred.injury_risk_level.upper()}",
                "color": color,
            })
        sections.append({"title": f"Riesgo de Lesión Elevado ({len(high_risk)})", "color": "#f97316", "items": items})

    return sections


@router.get("/preview")
def preview_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    sections = _build_alert_sections(db)
    total = sum(len(s["items"]) for s in sections)
    return {
        "total_alerts": total,
        "sections": sections,
        "email_enabled": settings.EMAIL_ALERTS_ENABLED,
        "smtp_configured": bool(settings.SMTP_USER and settings.SMTP_PASSWORD),
    }


@router.post("/send")
def send_alerts(
    recipients: List[str] = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    sections = _build_alert_sections(db)
    total = sum(len(s["items"]) for s in sections)

    if total == 0:
        return {"sent": 0, "message": "Sin alertas activas — no se enviaron emails"}

    subject = f"Alerta del plantel — {total} situaciones a revisar"
    sent = send_bulk_alert(recipients, subject, sections)

    return {
        "sent": sent,
        "attempted": len(recipients),
        "total_alerts": total,
        "email_enabled": settings.EMAIL_ALERTS_ENABLED,
        "message": f"Enviados {sent}/{len(recipients)} emails" if settings.EMAIL_ALERTS_ENABLED else "Modo preview — activa EMAIL_ALERTS_ENABLED en Railway para enviar emails reales",
    }
