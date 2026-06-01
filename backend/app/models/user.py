from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base
from ..core.crypto import EncryptedString


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

    # ── Two-factor auth (TOTP) ───────────────────────────────────────────
    # Secret is encrypted at rest (EncryptedString). `totp_enabled` flips True
    # only after the user proves they can generate a valid code (confirmed
    # enrolment). Recovery codes are stored as a JSON list of bcrypt hashes and
    # consumed one-shot. All columns nullable so additive `ensure_schema()`
    # backfills existing tables without a migration.
    totp_secret = Column(EncryptedString, nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=True)
    totp_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    totp_recovery_codes = Column(JSON, nullable=True)

    # Multi-tenant: every user belongs to a single club (nullable only for the
    # bootstrap super-admin who has no club affiliation).
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=True, index=True)
    club = relationship("Club", lazy="joined")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def two_factor_enabled(self) -> bool:
        """True when the user has a confirmed, active TOTP enrolment."""
        return bool(self.totp_enabled)

    @property
    def mfa_enrollment_required(self) -> bool:
        """Admins/super-admins must enrol in 2FA (enforced as a UI flag, not a
        hard login block — so a fresh deploy never locks every admin out)."""
        from ..core.config import settings  # local import: config has no model deps

        privileged = self.is_superadmin or self.role == UserRole.ADMIN
        return bool(privileged and settings.MFA_REQUIRED_FOR_ADMINS and not self.two_factor_enabled)
