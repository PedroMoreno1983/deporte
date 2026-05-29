from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from ..core.database import Base


class Tactical(Base):
    __tablename__ = "tacticals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    formation = Column(String, nullable=False)
    players_json = Column(Text, nullable=True)
    assignments_json = Column(Text, nullable=True)
    paths_json = Column(Text, nullable=True)
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
