from sqlalchemy import Column, Integer, Float, String, Date, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
from ..core.crypto import EncryptedString  # field-level encryption at rest (compliance #12)


class WellnessEntry(Base):
    __tablename__ = "wellness_entries"

    id         = Column(Integer, primary_key=True, index=True)
    player_id  = Column(Integer, ForeignKey("players.id"), nullable=False)
    player     = relationship("Player", back_populates="wellness_entries")

    entry_date = Column(Date, nullable=False)

    # Métricas subjetivas (1 = muy mal, 10 = excelente)
    sleep_quality    = Column(Integer, nullable=False)   # Calidad de sueño
    fatigue          = Column(Integer, nullable=False)   # Fatiga (1=muy fatigado, 10=sin fatiga)
    mood             = Column(Integer, nullable=False)   # Estado de ánimo
    muscle_soreness  = Column(Integer, nullable=False)   # Dolor muscular (1=mucho dolor, 10=sin dolor)
    stress           = Column(Integer, nullable=False)   # Nivel de estrés (1=muy estresado, 10=sin estrés)

    # RPE post-entrenamiento (opcional, se registra después de sesión)
    rpe_post = Column(Integer, nullable=True)  # 1-10

    # Score compuesto automático (promedio ponderado)
    wellness_score = Column(Float, nullable=True)

    notes      = Column(EncryptedString, nullable=True)  # nota subjetiva → cifrada at-rest
    created_at = Column(DateTime(timezone=True), server_default=func.now())
