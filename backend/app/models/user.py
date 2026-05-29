from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    COACH = "coach"
    KINESIOLOGIST = "kinesiologist"
    ANALYST = "analyst"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.COACH)
    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(String, nullable=True)

    # Multi-tenant: every user belongs to a single club (nullable only for the
    # bootstrap super-admin who has no club affiliation).
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=True, index=True)
    club = relationship("Club", lazy="joined")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
