"""
Injury Risk Model
Calcula el riesgo de lesión basado en:
- ACWR (Acute:Chronic Workload Ratio)
- Historial de lesiones
- Edad del jugador
- Carga acumulada reciente
- Días desde última lesión
"""
import numpy as np
from datetime import date, timedelta
from sqlalchemy.orm import Session
from ..models.training import TrainingSession
from ..models.injury import Injury
from ..models.player import Player


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
            acwr_score = 15  # Sub-carga
        elif acwr <= 1.3:
            acwr_score = 5   # Zona óptima
        elif acwr <= 1.5:
            acwr_score = 25  # Zona de advertencia
        else:
            acwr_score = 45  # Zona de peligro
        factors["acwr"] = {"value": round(acwr, 3), "contribution": acwr_score}
        score += acwr_score
    else:
        factors["acwr"] = {"value": None, "contribution": 0}

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
    factors["injury_history_12m"] = {"value": injuries_last_year, "contribution": injury_history_score}
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
            recency_score = 20
        elif days_since < 90:
            recency_score = 10
        elif days_since < 180:
            recency_score = 5
        else:
            recency_score = 0
        factors["days_since_last_injury"] = {"value": days_since, "contribution": recency_score}
        score += recency_score
    else:
        factors["days_since_last_injury"] = {"value": None, "contribution": 0}

    # --- Factor 4: Edad ---
    if player.date_of_birth:
        age = (today - player.date_of_birth).days // 365
        if age < 18:
            age_score = 5
        elif age < 25:
            age_score = 0
        elif age < 30:
            age_score = 5
        elif age < 33:
            age_score = 10
        else:
            age_score = 15
        factors["age"] = {"value": age, "contribution": age_score}
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
        load_score = 15
    elif weekly_load > 2000:
        load_score = 8
    else:
        load_score = 0
    factors["weekly_load"] = {"value": round(weekly_load, 1), "contribution": load_score}
    score += load_score

    final_score = min(round(score, 1), 100)
    return {
        "score": final_score,
        "level": get_risk_level(final_score),
        "factors": factors,
    }
