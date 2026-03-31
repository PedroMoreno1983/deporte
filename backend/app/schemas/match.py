from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class MatchCreate(BaseModel):
    date: date
    opponent: str
    is_home: bool = True
    competition: Optional[str] = None
    category_id: Optional[int] = None
    goals_for: Optional[int] = None
    goals_against: Optional[int] = None
    notes: Optional[str] = None


class MatchOut(MatchCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MatchStatCreate(BaseModel):
    player_id: int
    match_id: int
    minutes_played: int = 0
    started: bool = False
    rating: Optional[float] = None
    goals: int = 0
    assists: int = 0
    shots_total: int = 0
    shots_on_target: int = 0
    key_passes: int = 0
    passes_total: int = 0
    passes_completed: int = 0
    tackles: int = 0
    interceptions: int = 0
    clearances: int = 0
    fouls_committed: int = 0
    fouls_received: int = 0
    yellow_cards: int = 0
    red_cards: int = 0
    duels_total: int = 0
    duels_won: int = 0
    aerial_duels_total: int = 0
    aerial_duels_won: int = 0
    total_distance_m: Optional[float] = None
    high_intensity_distance_m: Optional[float] = None
    sprint_distance_m: Optional[float] = None
    max_speed_kmh: Optional[float] = None
    sprints_count: Optional[int] = None
    accelerations_count: Optional[int] = None
    notes: Optional[str] = None


class MatchStatOut(MatchStatCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
