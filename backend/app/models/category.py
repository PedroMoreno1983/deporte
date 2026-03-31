from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from ..core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)  # e.g. "Cadetes", "Sub-17"
    code = Column(String, unique=True, nullable=False)  # e.g. "CAD", "U17"
    min_age = Column(Integer, nullable=True)
    max_age = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    players = relationship("Player", back_populates="category")
