from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from ..database import Base


class TacticalPlay(Base):
    __tablename__ = "tactical_plays"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(200), nullable=False)
    formation    = Column(String(20),  nullable=False)
    players_json = Column(JSON, nullable=False)
    assignments_json = Column(JSON, nullable=True)
    paths_json   = Column(JSON, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())
