from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class KinesiologyCreate(BaseModel):
    player_id: int
    evaluation_date: date
    evaluated_by: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    bmi: Optional[float] = None
    squat_1rm_kg: Optional[float] = None
    bench_press_1rm_kg: Optional[float] = None
    nordic_hamstring_left: Optional[float] = None
    nordic_hamstring_right: Optional[float] = None
    cmj_height_cm: Optional[float] = None
    sj_height_cm: Optional[float] = None
    abalakov_height_cm: Optional[float] = None
    sit_and_reach_cm: Optional[float] = None
    thomas_test_left: Optional[float] = None
    thomas_test_right: Optional[float] = None
    hamstring_flexibility_left: Optional[float] = None
    hamstring_flexibility_right: Optional[float] = None
    vo2_max: Optional[float] = None
    yo_yo_test_level: Optional[str] = None
    yo_yo_test_distance: Optional[float] = None
    sprint_10m_sec: Optional[float] = None
    sprint_30m_sec: Optional[float] = None
    sprint_40m_sec: Optional[float] = None
    notes: Optional[str] = None


class KinesiologyOut(KinesiologyCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
