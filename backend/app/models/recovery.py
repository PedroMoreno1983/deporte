"""
Objective recovery / readiness data (Polar, Garmin, STATSports recovery).

Distinct from `WellnessEntry`, which is the *subjective* morning questionnaire
(sleep quality, mood, soreness on a 1-10 scale). This table holds *measured*
physiology — HRV, resting HR, sleep duration, vendor readiness scores — which
feed the injury model as objective features alongside the subjective ones.
"""
from __future__ import annotations

from sqlalchemy import (
    JSON, Column, Date, DateTime, Float, ForeignKey, Integer, String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class RecoveryRecord(Base):
    __tablename__ = "recovery_records"

    id          = Column(Integer, primary_key=True, index=True)
    player_id   = Column(Integer, ForeignKey("players.id"), nullable=False, index=True)
    club_id     = Column(Integer, ForeignKey("clubs.id"),   nullable=False, index=True)

    record_date = Column(Date, nullable=False, index=True)

    # Heart-rate variability (root mean square of successive differences, ms).
    hrv_rmssd        = Column(Float, nullable=True)
    resting_hr       = Column(Integer, nullable=True)   # bpm
    sleep_duration_h = Column(Float, nullable=True)     # hours
    sleep_score      = Column(Integer, nullable=True)   # 0-100 if vendor provides
    recovery_status  = Column(String, nullable=True)    # vendor label (e.g. "Good", "Compromised")
    readiness        = Column(Float, nullable=True)     # 0-100 normalised readiness

    source     = Column(String, nullable=True)          # provider value, e.g. "polar"
    extra      = Column(JSON,   nullable=True)           # vendor-specific extras
    import_job_id = Column(Integer, ForeignKey("import_jobs.id"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    player = relationship("Player")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<RecoveryRecord id={self.id} player={self.player_id} "
            f"{self.record_date} hrv={self.hrv_rmssd} rhr={self.resting_hr}>"
        )
