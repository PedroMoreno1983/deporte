from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from ..models.injury import InjurySeverity, InjuryMechanism, BodyZone


class InjuryCreate(BaseModel):
    player_id: int
    injury_date: date
    injury_type: str
    body_zone: BodyZone
    severity: InjurySeverity
    mechanism: InjuryMechanism
    description: Optional[str] = None
    during_match: bool = False
    estimated_days_out: Optional[int] = None
    return_date_estimated: Optional[date] = None
    treatment: Optional[str] = None
    surgery_required: bool = False
    surgery_date: Optional[date] = None
    diagnosed_by: Optional[str] = None
    notes: Optional[str] = None


class InjuryUpdate(BaseModel):
    return_date_actual: Optional[date] = None
    actual_days_out: Optional[int] = None
    treatment: Optional[str] = None
    recovery_milestones: Optional[str] = None
    is_recovered: Optional[bool] = None
    notes: Optional[str] = None


class InjuryOut(InjuryCreate):
    id: int
    return_date_actual: Optional[date] = None
    actual_days_out: Optional[int] = None
    recovery_milestones: Optional[str] = None
    is_recovered: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
