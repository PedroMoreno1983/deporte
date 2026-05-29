from sqlalchemy import Column, Integer, String, Boolean, Enum, Date, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base


class PlayerStatus(str, enum.Enum):
    AVAILABLE = "available"
    INJURED = "injured"
    SUSPENDED = "suspended"
    RECOVERING = "recovering"
    INACTIVE = "inactive"


class PlayerPosition(str, enum.Enum):
    GOALKEEPER = "goalkeeper"
    CENTER_BACK = "center_back"
    LEFT_BACK = "left_back"
    RIGHT_BACK = "right_back"
    DEFENSIVE_MID = "defensive_mid"
    CENTRAL_MID = "central_mid"
    ATTACKING_MID = "attacking_mid"
    LEFT_WING = "left_wing"
    RIGHT_WING = "right_wing"
    CENTER_FORWARD = "center_forward"


class DominantFoot(str, enum.Enum):
    LEFT = "left"
    RIGHT = "right"
    BOTH = "both"


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    # Personal info
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    nationality = Column(String, nullable=True)
    document_id = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)

    # Football info
    jersey_number = Column(Integer, nullable=True)
    position = Column(Enum(PlayerPosition), nullable=False)
    secondary_position = Column(Enum(PlayerPosition), nullable=True)
    dominant_foot = Column(Enum(DominantFoot), default=DominantFoot.RIGHT)
    status = Column(Enum(PlayerStatus), default=PlayerStatus.AVAILABLE)

    # Category
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    category = relationship("Category", back_populates="players")

    # Multi-tenant: denormalised for fast scoping
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)

    # Physical baseline
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    kinesiology_records = relationship("KinesiologyRecord", back_populates="player", cascade="all, delete-orphan")
    injuries = relationship("Injury", back_populates="player", cascade="all, delete-orphan")
    match_stats = relationship("MatchStat", back_populates="player", cascade="all, delete-orphan")
    training_sessions = relationship("TrainingSession", back_populates="player", cascade="all, delete-orphan")
    prediction_scores = relationship("PredictionScore", back_populates="player", cascade="all, delete-orphan")
    wellness_entries  = relationship("WellnessEntry",   back_populates="player", cascade="all, delete-orphan")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
