from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from ..models.training import SessionType


class TrainingSessionCreate(BaseModel):
    player_id: int
    session_date: date
    session_type: SessionType = SessionType.TRAINING
    duration_minutes: Optional[int] = None
    rpe: Optional[int] = None
    total_distance_m: Optional[float] = None
    high_intensity_distance_m: Optional[float] = None
    sprint_distance_m: Optional[float] = None
    max_speed_kmh: Optional[float] = None
    sprints_count: Optional[int] = None
    accelerations_count: Optional[int] = None
    decelerations_count: Optional[int] = None
    participated: bool = True
    notes: Optional[str] = None


class TrainingSessionOut(TrainingSessionCreate):
    id: int
    session_load: Optional[float] = None
    acute_load: Optional[float] = None
    chronic_load: Optional[float] = None
    acwr: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True
