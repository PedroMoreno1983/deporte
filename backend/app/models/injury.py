from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Text, Enum, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base
from ..core.crypto import EncryptedString  # field-level encryption at rest (compliance #12)


class InjurySeverity(str, enum.Enum):
    GRADE_1 = "grade_1"   # Leve (1-7 días)
    GRADE_2 = "grade_2"   # Moderado (7-28 días)
    GRADE_3 = "grade_3"   # Severo (>28 días)
    GRADE_4 = "grade_4"   # Muy severo / cirugía


class InjuryMechanism(str, enum.Enum):
    CONTACT = "contact"
    NON_CONTACT = "non_contact"
    OVERLOAD = "overload"
    REINJURY = "reinjury"


class BodyZone(str, enum.Enum):
    HEAD = "head"
    NECK = "neck"
    SHOULDER_LEFT = "shoulder_left"
    SHOULDER_RIGHT = "shoulder_right"
    ARM_LEFT = "arm_left"
    ARM_RIGHT = "arm_right"
    WRIST_LEFT = "wrist_left"
    WRIST_RIGHT = "wrist_right"
    THORAX = "thorax"
    LUMBAR = "lumbar"
    ABDOMEN = "abdomen"
    HIP_LEFT = "hip_left"
    HIP_RIGHT = "hip_right"
    THIGH_LEFT = "thigh_left"
    THIGH_RIGHT = "thigh_right"
    KNEE_LEFT = "knee_left"
    KNEE_RIGHT = "knee_right"
    LEG_LEFT = "leg_left"
    LEG_RIGHT = "leg_right"
    ANKLE_LEFT = "ankle_left"
    ANKLE_RIGHT = "ankle_right"
    FOOT_LEFT = "foot_left"
    FOOT_RIGHT = "foot_right"


class Injury(Base):
    __tablename__ = "injuries"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    player = relationship("Player", back_populates="injuries")

    # Lesión
    injury_date = Column(Date, nullable=False)
    injury_type = Column(String, nullable=False)         # "Rotura muscular", "Esguince", etc.
    body_zone = Column(Enum(BodyZone), nullable=False)
    severity = Column(Enum(InjurySeverity), nullable=False)
    mechanism = Column(Enum(InjuryMechanism), nullable=False)
    # Clinical narrative = sensitive health data → encrypted at rest. Kept as the
    # decrypted plaintext in Python; never used in SQL filters/aggregations.
    description = Column(EncryptedString, nullable=True)
    during_match = Column(Boolean, default=False)

    # Baja
    estimated_days_out = Column(Integer, nullable=True)
    return_date_estimated = Column(Date, nullable=True)
    return_date_actual = Column(Date, nullable=True)
    actual_days_out = Column(Integer, nullable=True)

    # Tratamiento
    treatment = Column(EncryptedString, nullable=True)
    surgery_required = Column(Boolean, default=False)
    surgery_date = Column(Date, nullable=True)

    # Recuperación
    recovery_milestones = Column(EncryptedString, nullable=True)  # JSON string con hitos (cifrado)
    is_recovered = Column(Boolean, default=False)

    diagnosed_by = Column(String, nullable=True)
    notes = Column(EncryptedString, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
