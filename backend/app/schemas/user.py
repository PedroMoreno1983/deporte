from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from ..models.user import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginResponse(BaseModel):
    """Result of /auth/login and /auth/login/verify.

    Two shapes share one model so a single response_model documents both:
      - 2FA required  → ``mfa_required=True`` + ``mfa_token`` (no access tokens yet)
      - authenticated → ``access_token`` + ``refresh_token`` + ``user``
    """
    mfa_required: bool = False
    mfa_token: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional["UserOut"] = None
    # True when a privileged user authenticated but still has to enrol in 2FA.
    mfa_enrollment_required: bool = False


# ── 2FA (TOTP) enrolment & verification ──────────────────────────────────────
class MfaVerifyRequest(BaseModel):
    """Second step of login: the challenge token + a TOTP or recovery code."""
    mfa_token: str
    code: str


class MfaSetupResponse(BaseModel):
    """Returned by /auth/mfa/setup — render ``otpauth_uri`` as a QR to enrol."""
    secret: str
    otpauth_uri: str
    issuer: str
    digits: int
    period: int


class MfaEnableRequest(BaseModel):
    code: str = Field(..., description="A current TOTP code proving the secret was stored")


class MfaEnableResponse(BaseModel):
    """One-time display of recovery codes — never retrievable again."""
    enabled: bool = True
    recovery_codes: List[str]


class MfaDisableRequest(BaseModel):
    password: str
    code: Optional[str] = Field(None, description="Current TOTP or recovery code")


class MfaRegenerateRequest(BaseModel):
    code: str = Field(..., description="Current TOTP or recovery code")


class MfaStatus(BaseModel):
    enabled: bool
    confirmed_at: Optional[datetime] = None
    recovery_codes_remaining: int = 0
    enrollment_required: bool = False


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.COACH
    club_id: Optional[int] = None  # Resolved server-side if omitted


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    club_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    is_superadmin: bool = False
    avatar_url: Optional[str] = None
    club_id: Optional[int] = None
    two_factor_enabled: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


TokenResponse.model_rebuild()
LoginResponse.model_rebuild()
