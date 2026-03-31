"""
Performance Projection Model
Proyecta el rendimiento del jugador basado en:
- Estadísticas de los últimos partidos
- Métricas físicas de entrenamientos
- Tendencia de calificaciones
- Disponibilidad y minutos jugados
"""
import numpy as np
from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from ..models.match import MatchStat
from ..models.training import TrainingSession
from ..models.kinesiology import KinesiologyRecord


def calculate_performance_index(stat) -> float:
    """Calcula índice de rendimiento 0-100 para un MatchStat."""
    if not stat or stat.minutes_played == 0:
        return 0.0

    score = 0.0
    # Rating directo (peso 40%)
    if stat.rating:
        score += stat.rating * 4.0

    # Goles y asistencias (peso 20%)
    goal_contrib = (stat.goals * 3 + stat.assists * 1.5)
    score += min(goal_contrib * 3, 20)

    # Precisión de pases (peso 15%)
    if stat.passes_total and stat.passes_total > 0:
        pass_acc = stat.passes_completed / stat.passes_total
        score += pass_acc * 15

    # Duelos ganados (peso 10%)
    if stat.duels_total and stat.duels_total > 0:
        duel_rate = stat.duels_won / stat.duels_total
        score += duel_rate * 10

    # Distancia recorrida (peso 15%)
    if stat.total_distance_m:
        dist_score = min(stat.total_distance_m / 120, 15)  # 12km → 15pts
        score += dist_score

    return min(round(score, 2), 100)


def calculate_performance_projection(player_id: int, db: Session) -> dict:
    today = date.today()
    last_8_weeks = today - timedelta(weeks=8)

    # Obtener últimas stats de partidos
    recent_stats = (
        db.query(MatchStat)
        .filter(MatchStat.player_id == player_id)
        .order_by(MatchStat.id.desc())
        .limit(10)
        .all()
    )

    if not recent_stats:
        return {
            "current_index": None,
            "trend": "insufficient_data",
            "forecast_4w": None,
            "confidence": 0.0,
        }

    indices = [calculate_performance_index(s) for s in recent_stats if s.minutes_played > 0]
    if not indices:
        return {
            "current_index": None,
            "trend": "insufficient_data",
            "forecast_4w": None,
            "confidence": 0.0,
        }

    current_index = round(np.mean(indices[-3:]) if len(indices) >= 3 else indices[0], 2)

    # Tendencia (comparar últimas 3 vs anteriores 3-7)
    if len(indices) >= 6:
        recent_avg = np.mean(indices[:3])
        older_avg = np.mean(indices[3:6])
        diff = recent_avg - older_avg
        if diff > 5:
            trend = "improving"
        elif diff < -5:
            trend = "declining"
        else:
            trend = "stable"
    elif len(indices) >= 3:
        trend = "stable"
    else:
        trend = "insufficient_data"

    # Proyección 4 semanas con tendencia lineal simple
    if len(indices) >= 4:
        x = np.arange(len(indices))
        coeffs = np.polyfit(x, indices[::-1], 1)  # más recientes al final
        slope = coeffs[0]
        base = current_index
        forecast = [
            round(min(max(base + slope * (i + 1), 0), 100), 2)
            for i in range(4)
        ]
        confidence = min(0.9, 0.5 + len(indices) * 0.05)
    else:
        forecast = [current_index] * 4
        confidence = 0.4

    return {
        "current_index": current_index,
        "trend": trend,
        "forecast_4w": forecast,
        "confidence": round(confidence, 2),
    }
