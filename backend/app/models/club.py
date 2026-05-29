from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from ..core.database import Base


class Club(Base):
    """A football club / tenant.

    Every domain row (player, match, injury, etc.) is scoped to a single club.
    A user belongs to exactly one club (1:N). Cross-club access is only available
    to global super-admins (`User.is_superadmin = True`).
    """
    __tablename__ = "clubs"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String,  nullable=False)
    slug        = Column(String,  nullable=False, unique=True, index=True)
    country     = Column(String,  nullable=True)
    league      = Column(String,  nullable=True)
    crest_url   = Column(String,  nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
