from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
from ..core.crypto import EncryptedString  # field-level encryption at rest (compliance #12)


class PredictionScore(Base):
    __tablename__ = "prediction_scores"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    player = relationship("Player", back_populates="prediction_scores")

    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    # Riesgo de lesión
    injury_risk_score = Column(Float, nullable=True)       # 0-100
    injury_risk_level = Column(String, nullable=True)      # "low", "medium", "high", "critical"
    injury_risk_factors = Column(JSON, nullable=True)      # dict con factores contribuyentes

    # Proyección de rendimiento
    performance_projection = Column(Float, nullable=True)  # índice 0-100
    performance_trend = Column(String, nullable=True)      # "improving", "stable", "declining"
    performance_forecast_4w = Column(JSON, nullable=True)  # lista de 4 valores semanales
    performance_confidence = Column(Float, nullable=True)  # 0-1

    # Disponibilidad estimada
    availability_forecast_pct = Column(Float, nullable=True)  # % disponibilidad próximas 4 semanas

    model_version = Column(String, default="1.0.0")
    notes = Column(EncryptedString, nullable=True)  # narrativa de riesgo → cifrada at-rest
