from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime
from ..models.player import PlayerStatus, PlayerPosition, DominantFoot
from .category import CategoryOut


class PlayerCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    nationality: Optional[str] = None
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    jersey_number: Optional[int] = None
    position: PlayerPosition
    secondary_position: Optional[PlayerPosition] = None
    dominant_foot: DominantFoot = DominantFoot.RIGHT
    category_id: int
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None


class PlayerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    jersey_number: Optional[int] = None
    position: Optional[PlayerPosition] = None
    secondary_position: Optional[PlayerPosition] = None
    dominant_foot: Optional[DominantFoot] = None
    category_id: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    status: Optional[PlayerStatus] = None


class PlayerSummary(BaseModel):
    id: int
    first_name: str
    last_name: str
    jersey_number: Optional[int] = None
    position: PlayerPosition
    status: PlayerStatus
    photo_url: Optional[str] = None
    category_id: int

    class Config:
        from_attributes = True


class PlayerOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    date_of_birth: date
    nationality: Optional[str] = None
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    jersey_number: Optional[int] = None
    position: PlayerPosition
    secondary_position: Optional[PlayerPosition] = None
    dominant_foot: DominantFoot
    status: PlayerStatus
    category: CategoryOut
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
