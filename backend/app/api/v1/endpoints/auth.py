from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from ....core.database import get_db
from ....core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    create_mfa_token,
    decode_mfa_token,
)
from ....core.deps import get_current_user
from ....core.permissions import user_permissions
from ....core import two_factor
from ....core.audit import audit
from ....models.user import User
from ....schemas.user import LoginRequest, LoginResponse, MfaVerifyRequest, TokenResponse, UserOut

router = APIRouter()


def _token_payload(user: User) -> dict:
    return {
        "sub":  str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "club": user.club_id,
        "sa":   bool(user.is_superadmin),
    }


def _issue_session(user: User) -> LoginResponse:
    """Build the authenticated response (access + refresh + user)."""
    payload = _token_payload(user)
    return LoginResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
        user=UserOut.model_validate(user),
        mfa_enrollment_required=user.mfa_enrollment_required,
    )


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cuenta desactivada")

    # Password OK. If 2FA is on, don't hand out tokens yet — issue a short-lived
    # challenge token that only authorises completing the second factor.
    if user.two_factor_enabled:
        audit(db, user=user, action="login.mfa_challenge", entity="auth",
              entity_id=user.id, request=request)
        return LoginResponse(mfa_required=True, mfa_token=create_mfa_token(user.id))

    audit(db, user=user, action="login.success", entity="auth",
          entity_id=user.id, request=request)
    return _issue_session(user)


@router.post("/login/verify", response_model=LoginResponse)
def login_verify(data: MfaVerifyRequest, request: Request, db: Session = Depends(get_db)):
    """Second login step: exchange the MFA challenge token + a TOTP/recovery code
    for a real session."""
    user_id = decode_mfa_token(data.mfa_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de verificación inválido o expirado")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado o inactivo")
    if not user.two_factor_enabled:
        # 2FA was turned off between steps — nothing to verify; just sign in.
        return _issue_session(user)

    method = two_factor.verify_second_factor(user, data.code)
    if method is None:
        audit(db, user=user, action="login.mfa_failed", entity="auth",
              entity_id=user.id, request=request)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código de verificación incorrecto")

    db.commit()  # persist a consumed recovery code, if that's what was used
    audit(db, user=user, action="login.mfa_success", entity="auth", entity_id=user.id,
          delta={"method": method}, request=request)
    return _issue_session(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(token: str, db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    new_payload = _token_payload(user)
    return TokenResponse(
        access_token=create_access_token(new_payload),
        refresh_token=create_refresh_token(new_payload),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/permissions")
def get_my_permissions(current_user: User = Depends(get_current_user)):
    """Return the set of permission strings the current user has.
    The frontend uses this to hide unauthorised actions."""
    return {"permissions": sorted(user_permissions(current_user))}
