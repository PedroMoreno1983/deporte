"""
Injury Risk Model
=================

Two-tier risk engine with a single public entry point, :func:`calculate_injury_risk`:

1. **Trained model (preferred).** A real XGBoost classifier over an ingested
   feature set (training load, ACWR, wellness, objective recovery, injury
   history, match minutes), explained per-prediction with SHAP. Lives in the
   :mod:`app.ml.injury` package.
2. **Heuristic fallback (cold start).** The transparent rule-based scoring below
   — used on a brand-new deployment with no trained model yet, when the ML
   extras aren't installed, or if the model errors. It is intentionally kept,
   not deleted: it guarantees the endpoint always returns a sane answer.

Both tiers return the exact same shape — ``{"score", "level", "factors"}`` — so
the prediction endpoint, the ``PredictionScore`` row and the frontend are
agnostic to which produced the number.

The heuristic factors:
- ACWR (Acute:Chronic Workload Ratio)
- Historial de lesiones
- Edad del jugador
- Carga acumulada reciente
- Días desde última lesión
"""
import logging
from datetime import date, timedelta
from sqlalchemy.orm import Session
from ..models.training import TrainingSession
from ..models.injury import Injury
from ..models.player import Player

logger = logging.getLogger(__name__)


RISK_THRESHOLDS = {
    "low": (0, 30),
    "medium": (30, 55),
    "high": (55, 75),
    "critical": (75, 100),
}


def get_risk_level(score: float) -> str:
    for level, (low, high) in RISK_THRESHOLDS.items():
        if low <= score < high:
            return level
    return "critical"


def calculate_injury_risk(player_id: int, db: Session) -> dict:
    """Public entry point: trained model first, heuristic fallback.

    Never raises on the ML path — any failure (missing model, missing extras,
    explainer error) is logged and degrades gracefully to the heuristic so the
    API contract is always honoured.
    """
    try:
        from .injury.predictor import predict_risk

        result = predict_risk(player_id, db)
        if result is not None:
            return result
    except Exception:  # pragma: no cover - defensive: ML must never break serving
        logger.exception("Trained injury model failed; falling back to heuristic")
    return rule_based_injury_risk(player_id, db)


def rule_based_injury_risk(player_id: int, db: Session) -> dict:
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        return {"score": 0, "level": "low", "factors": {}}

    today = date.today()
    factors = {}
    score = 0.0

    # --- Factor 1: ACWR ---
    last_session = (
        db.query(TrainingSession)
        .filter(TrainingSession.player_id == player_id, TrainingSession.acwr.isnot(None))
        .order_by(TrainingSession.session_date.desc())
        .first()
    )
    acwr = last_session.acwr if last_session else None
    if acwr is not None:
        if acwr < 0.8:
            acwr_score, acwr_desc = 15, "Sub-carga: el jugador entrena menos de lo habitual, descondicionamiento aumenta riesgo."
        elif acwr <= 1.3:
            acwr_score, acwr_desc = 5,  "Zona óptima de carga: relación aguda/crónica entre 0.8 y 1.3."
        elif acwr <= 1.5:
            acwr_score, acwr_desc = 25, "Carga elevada respecto al promedio crónico — zona de advertencia."
        else:
            acwr_score, acwr_desc = 45, "Sobrecarga significativa (ACWR > 1.5) — alto riesgo de lesión por fatiga."
        factors["acwr"] = {
            "label": "Carga aguda/crónica (ACWR)",
            "value": round(acwr, 3),
            "contribution": acwr_score,
            "description": acwr_desc,
        }
        score += acwr_score
    else:
        factors["acwr"] = {
            "label": "Carga aguda/crónica (ACWR)",
            "value": None,
            "contribution": 0,
            "description": "Sin datos suficientes para calcular ACWR.",
        }

    # --- Factor 2: Historial de lesiones ---
    injuries_last_year = (
        db.query(Injury)
        .filter(
            Injury.player_id == player_id,
            Injury.injury_date >= today - timedelta(days=365),
        )
        .count()
    )
    injury_history_score = min(injuries_last_year * 8, 24)
    factors["injury_history_12m"] = {
        "label": "Lesiones últimos 12 meses",
        "value": injuries_last_year,
        "contribution": injury_history_score,
        "description": (
            "Sin lesiones registradas en el último año." if injuries_last_year == 0
            else f"{injuries_last_year} lesión(es) recientes — recidiva es el predictor más fuerte de nueva lesión."
        ),
    }
    score += injury_history_score

    # --- Factor 3: Días desde última lesión ---
    last_injury = (
        db.query(Injury)
        .filter(Injury.player_id == player_id)
        .order_by(Injury.injury_date.desc())
        .first()
    )
    if last_injury:
        days_since = (today - last_injury.injury_date).days
        if days_since < 30:
            recency_score, recency_desc = 20, "Lesión muy reciente (<30 días) — retorno temprano eleva el riesgo."
        elif days_since < 90:
            recency_score, recency_desc = 10, "Lesión en los últimos 3 meses — todavía en fase de readaptación."
        elif days_since < 180:
            recency_score, recency_desc = 5,  "Lesión hace 3-6 meses — riesgo residual moderado."
        else:
            recency_score, recency_desc = 0,  "Más de 6 meses sin lesiones — sin efecto residual."
        factors["days_since_last_injury"] = {
            "label": "Días desde última lesión",
            "value": days_since,
            "contribution": recency_score,
            "description": recency_desc,
        }
        score += recency_score
    else:
        factors["days_since_last_injury"] = {
            "label": "Días desde última lesión",
            "value": None,
            "contribution": 0,
            "description": "Sin lesiones registradas históricamente.",
        }

    # --- Factor 4: Edad ---
    if player.date_of_birth:
        age = (today - player.date_of_birth).days // 365
        if age < 18:
            age_score, age_desc = 5,  "Edad joven — riesgo por inmadurez músculo-esquelética."
        elif age < 25:
            age_score, age_desc = 0,  "Franja etaria de menor riesgo (18-25)."
        elif age < 30:
            age_score, age_desc = 5,  "Riesgo neutro (25-30)."
        elif age < 33:
            age_score, age_desc = 10, "Riesgo en aumento (30-33) — degeneración tendinosa progresiva."
        else:
            age_score, age_desc = 15, "Edad ≥33 — mayor incidencia de lesiones musculares y articulares."
        factors["age"] = {
            "label": "Edad",
            "value": age,
            "contribution": age_score,
            "description": age_desc,
        }
        score += age_score

    # --- Factor 5: Carga semanal reciente ---
    sessions_7d = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.player_id == player_id,
            TrainingSession.session_date >= today - timedelta(days=7),
            TrainingSession.session_load.isnot(None),
        )
        .all()
    )
    weekly_load = sum(s.session_load for s in sessions_7d if s.session_load)
    if weekly_load > 3000:
        load_score, load_desc = 15, "Carga semanal muy alta (>3000 UA) — riesgo de fatiga acumulada."
    elif weekly_load > 2000:
        load_score, load_desc = 8,  "Carga semanal elevada (2000-3000 UA)."
    else:
        load_score, load_desc = 0,  "Carga semanal dentro de rango seguro."
    factors["weekly_load"] = {
        "label": "Carga semanal (UA)",
        "value": round(weekly_load, 1),
        "contribution": load_score,
        "description": load_desc,
    }
    score += load_score

    final_score = min(round(score, 1), 100)
    return {
        "score": final_score,
        "level": get_risk_level(final_score),
        "factors": factors,
    }
