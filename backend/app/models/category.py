from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from ..core.database import Base


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("club_id", "name", name="uq_categories_club_name"),
        UniqueConstraint("club_id", "code", name="uq_categories_club_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g. "Cadetes", "Sub-17"
    code = Column(String, nullable=False)  # e.g. "CAD", "U17"
    min_age = Column(Integer, nullable=True)
    max_age = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)

    players = relationship("Player", back_populates="category")
