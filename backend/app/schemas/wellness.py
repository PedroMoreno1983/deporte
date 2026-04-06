from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime


class WellnessCreate(BaseModel):
    player_id:       int
    entry_date:      date
    sleep_quality:   int = Field(..., ge=1, le=10)
    fatigue:         int = Field(..., ge=1, le=10)
    mood:            int = Field(..., ge=1, le=10)
    muscle_soreness: int = Field(..., ge=1, le=10)
    stress:          int = Field(..., ge=1, le=10)
    rpe_post:        Optional[int] = Field(None, ge=1, le=10)
    notes:           Optional[str] = None


class WellnessOut(WellnessCreate):
    id:             int
    wellness_score: Optional[float] = None
    created_at:     datetime

    class Config:
        from_attributes = True


class WellnessTeamEntry(BaseModel):
    """Wellness de un jugador para la vista de equipo"""
    player_id:       int
    player_name:     str
    jersey_number:   Optional[int]
    wellness_score:  Optional[float]
    sleep_quality:   Optional[int]
    fatigue:         Optional[int]
    mood:            Optional[int]
    muscle_soreness: Optional[int]
    stress:          Optional[int]
    rpe_post:        Optional[int]
    has_entry:       bool
    alert:           bool   # True si alguna métrica está en riesgo

    class Config:
        from_attributes = True


class WellnessTeamSummary(BaseModel):
    date:           date
    total_players:  int
    responded:      int
    avg_score:      Optional[float]
    alerts:         int   # jugadores con score < 5
    entries:        List[WellnessTeamEntry]
