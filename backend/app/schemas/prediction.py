from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime


class PredictionScoreOut(BaseModel):
    id: int
    player_id: int
    calculated_at: datetime
    injury_risk_score: Optional[float] = None
    injury_risk_level: Optional[str] = None
    injury_risk_factors: Optional[Dict[str, Any]] = None
    performance_projection: Optional[float] = None
    performance_trend: Optional[str] = None
    performance_forecast_4w: Optional[List[float]] = None
    performance_confidence: Optional[float] = None
    availability_forecast_pct: Optional[float] = None
    model_version: str

    class Config:
        from_attributes = True
