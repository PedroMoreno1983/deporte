from sqlalchemy import Column, Integer, Float, String, Date, ForeignKey, DateTime, Text, Enum, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base


class SessionType(str, enum.Enum):
    MATCH = "match"
    TRAINING = "training"
    GYM = "gym"
    RECOVERY = "recovery"
    REHABILITATION = "rehabilitation"
    REST = "rest"


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    player = relationship("Player", back_populates="training_sessions")
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)

    session_date = Column(Date, nullable=False)
    session_type = Column(Enum(SessionType), default=SessionType.TRAINING)
    duration_minutes = Column(Integer, nullable=True)

    # Carga subjetiva
    rpe = Column(Integer, nullable=True)  # Rate of Perceived Exertion (1-10)
    session_load = Column(Float, nullable=True)  # RPE × duración

    # GPS / físico
    total_distance_m = Column(Float, nullable=True)
    high_intensity_distance_m = Column(Float, nullable=True)
    sprint_distance_m = Column(Float, nullable=True)
    max_speed_kmh = Column(Float, nullable=True)
    sprints_count = Column(Integer, nullable=True)
    accelerations_count = Column(Integer, nullable=True)
    decelerations_count = Column(Integer, nullable=True)

    # Catapult/STATSports signature load metric (a.u.). Kept first-class because
    # it feeds ACWR and the injury model alongside RPE-based session_load.
    player_load = Column(Float, nullable=True)
    # Vendor-specific extras that don't have a dedicated column
    # (e.g. STATSports Dynamic Stress Load, metabolic power, HR zones).
    extra_metrics = Column(JSON, nullable=True)

    # Indicadores de carga calculados
    acute_load = Column(Float, nullable=True)    # Promedio últimos 7 días
    chronic_load = Column(Float, nullable=True)  # Promedio últimos 28 días
    acwr = Column(Float, nullable=True)          # Acute:Chronic Workload Ratio

    participated = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
