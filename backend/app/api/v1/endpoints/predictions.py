from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ....core.database import get_db
from ....core.deps import get_current_user
from ....models.prediction import PredictionScore
from ....schemas.prediction import PredictionScoreOut
from ....ml.injury_risk import calculate_injury_risk
from ....ml.performance import calculate_performance_projection
from ....ml.load_recommendations import recommend_team
from ....core.deps import get_current_user, get_current_club_id
from ....models.user import User

router = APIRouter()


@router.get("/player/{player_id}", response_model=PredictionScoreOut)
def get_player_predictions(player_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Recalcula y devuelve predicciones actualizadas para un jugador."""
    injury_data = calculate_injury_risk(player_id, db)
    perf_data = calculate_performance_projection(player_id, db)

    # Guardar en BD (upsert por player_id — mantener historial)
    prediction = PredictionScore(
        player_id=player_id,
        injury_risk_score=injury_data["score"],
        injury_risk_level=injury_data["level"],
        injury_risk_factors=injury_data["factors"],
        performance_projection=perf_data.get("current_index"),
        performance_trend=perf_data.get("trend"),
        performance_forecast_4w=perf_data.get("forecast_4w"),
        performance_confidence=perf_data.get("confidence"),
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction


@router.get("/player/{player_id}/history", response_model=List[PredictionScoreOut])
def get_prediction_history(player_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(PredictionScore)
        .filter(PredictionScore.player_id == player_id)
        .order_by(PredictionScore.calculated_at.desc())
        .limit(30)
        .all()
    )


@router.get("/team/load-recommendations")
def get_load_recommendations(
    db: Session = Depends(get_db),
    club_id: int = Depends(get_current_club_id),
):
    """Return per-player load-management recommendations for the current club."""
    return recommend_team(db, club_id=club_id)


@router.get("/team/risk-summary")
def get_team_risk_summary(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Resumen de riesgo de todo el equipo."""
    from ....models.player import Player, PlayerStatus
    players = db.query(Player).filter(Player.is_active == True, Player.status != PlayerStatus.INJURED).all()
    results = []
    for player in players:
        risk = calculate_injury_risk(player.id, db)
        results.append({
            "player_id": player.id,
            "player_name": player.full_name,
            "category_id": player.category_id,
            "risk_score": risk["score"],
            "risk_level": risk["level"],
        })
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results
