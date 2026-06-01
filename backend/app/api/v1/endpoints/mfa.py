"""Two-factor (TOTP) enrolment & management for the signed-in user.

Mounted under ``/auth`` so the public paths read ``/auth/mfa/...``. The login
*challenge* itself lives in ``auth.py``; this module covers the authenticated
lifecycle: setup → enable → (regenerate / disable) and a status read.

Enrolment is two-phase on purpose: ``setup`` stores an *unconfirmed* secret and
``enable`` only flips 2FA on once the user proves they can generate a valid code
— so a mistyped/never-scanned secret can't lock anyone out.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ....core.audit import audit
from ....core.config import settings
from ....core.database import get_db
from ....core.deps import get_current_user
from ....core import two_factor
from ....core.security import verify_password
from ....models.user import User
from ....schemas.user import (
    MfaDisableRequest,
    MfaEnableRequest,
    MfaEnableResponse,
    MfaRegenerateRequest,
    MfaSetupResponse,
    MfaStatus,
)
from ....core import totp as totp_core

router = APIRouter()


@router.get("/mfa/status", response_model=MfaStatus)
def mfa_status(current_user: User = Depends(get_current_user)):
    return MfaStatus(
        enabled=current_user.two_factor_enabled,
        confirmed_at=current_user.totp_confirmed_at,
        recovery_codes_remaining=two_factor.recovery_codes_remaining(current_user),
        enrollment_required=current_user.mfa_enrollment_required,
    )


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def mfa_setup(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a fresh secret and return the otpauth URI to render as a QR.

    Idempotent before confirmation: calling it again rotates the pending secret.
    Once 2FA is already enabled, re-running requires an explicit disable first
    (so an attacker with a live session can't silently swap the secret).
    """
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="2FA ya está activo; desactívalo antes de volver a configurarlo",
        )
    secret, uri = two_factor.begin_enrollment(current_user)
    db.commit()
    audit(db, user=current_user, action="mfa.setup", entity="auth",
          entity_id=current_user.id, request=request)
    return MfaSetupResponse(
        secret=secret,
        otpauth_uri=uri,
        issuer=settings.MFA_ISSUER,
        digits=totp_core.DEFAULT_DIGITS,
        period=totp_core.DEFAULT_PERIOD,
    )


@router.post("/mfa/enable", response_model=MfaEnableResponse)
def mfa_enable(
    data: MfaEnableRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirm enrolment with a current code; returns one-time recovery codes."""
    if current_user.two_factor_enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="2FA ya está activo")
    if not current_user.totp_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Primero ejecuta /auth/mfa/setup")

    recovery = two_factor.confirm_enrollment(current_user, data.code)
    if recovery is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código incorrecto")
    db.commit()
    audit(db, user=current_user, action="mfa.enable", entity="auth",
          entity_id=current_user.id, request=request)
    return MfaEnableResponse(enabled=True, recovery_codes=recovery)


@router.post("/mfa/recovery-codes", response_model=MfaEnableResponse)
def mfa_regenerate_recovery(
    data: MfaRegenerateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace all recovery codes (invalidating the old set). Requires a current
    TOTP or recovery code to authorise."""
    if not current_user.two_factor_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA no está activo")
    if two_factor.verify_second_factor(current_user, data.code) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código incorrecto")
    recovery = two_factor.regenerate_recovery_codes(current_user)
    db.commit()
    audit(db, user=current_user, action="mfa.recovery_regenerate", entity="auth",
          entity_id=current_user.id, request=request)
    return MfaEnableResponse(enabled=True, recovery_codes=recovery)


@router.post("/mfa/disable", status_code=status.HTTP_204_NO_CONTENT)
def mfa_disable(
    data: MfaDisableRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Turn 2FA off. Requires the account password and (if enrolled) a current
    TOTP/recovery code — defence in depth against a hijacked session."""
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contraseña incorrecta")
    if current_user.two_factor_enabled:
        if not data.code or two_factor.verify_second_factor(current_user, data.code) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código incorrecto")
    two_factor.disable(current_user)
    db.commit()
    audit(db, user=current_user, action="mfa.disable", entity="auth",
          entity_id=current_user.id, request=request)
    return None
