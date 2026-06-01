from sqlalchemy import Column, Integer, Float, String, Date, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
from ..core.crypto import EncryptedString  # field-level encryption at rest (compliance #12)


class KinesiologyRecord(Base):
    __tablename__ = "kinesiology_records"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    player = relationship("Player", back_populates="kinesiology_records")

    evaluation_date = Column(Date, nullable=False)
    evaluated_by = Column(String, nullable=True)

    # Composición corporal
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    body_fat_percentage = Column(Float, nullable=True)
    muscle_mass_kg = Column(Float, nullable=True)
    bmi = Column(Float, nullable=True)

    # Test de fuerza
    squat_1rm_kg = Column(Float, nullable=True)
    bench_press_1rm_kg = Column(Float, nullable=True)
    nordic_hamstring_left = Column(Float, nullable=True)
    nordic_hamstring_right = Column(Float, nullable=True)

    # Test de salto
    cmj_height_cm = Column(Float, nullable=True)   # Countermovement Jump
    sj_height_cm = Column(Float, nullable=True)    # Squat Jump
    abalakov_height_cm = Column(Float, nullable=True)

    # Test de flexibilidad
    sit_and_reach_cm = Column(Float, nullable=True)
    thomas_test_left = Column(Float, nullable=True)
    thomas_test_right = Column(Float, nullable=True)
    hamstring_flexibility_left = Column(Float, nullable=True)
    hamstring_flexibility_right = Column(Float, nullable=True)

    # Capacidad aeróbica
    vo2_max = Column(Float, nullable=True)
    yo_yo_test_level = Column(String, nullable=True)
    yo_yo_test_distance = Column(Float, nullable=True)

    # Velocidad
    sprint_10m_sec = Column(Float, nullable=True)
    sprint_30m_sec = Column(Float, nullable=True)
    sprint_40m_sec = Column(Float, nullable=True)

    notes = Column(EncryptedString, nullable=True)  # observación clínica → cifrada at-rest
    created_at = Column(DateTime(timezone=True), server_default=func.now())
