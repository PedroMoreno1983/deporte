from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ....core.database import get_db
from ....core.security import verify_password, create_access_token, create_refresh_token, decode_token
from ....core.deps import get_current_user
from ....core.permissions import user_permissions
from ....models.user import User
from ....schemas.user import LoginRequest, TokenResponse, UserOut

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cuenta desactivada")

    token_data = {
        "sub":    str(user.id),
        "role":   user.role.value if hasattr(user.role, "value") else str(user.role),
        "club":   user.club_id,
        "sa":     bool(user.is_superadmin),
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(token: str, db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    token_data = {
        "sub":  str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "club": user.club_id,
        "sa":   bool(user.is_superadmin),
    }
    access_token = create_access_token(token_data)
    new_refresh  = create_refresh_token(token_data)
    return TokenResponse(access_token=access_token, refresh_token=new_refresh, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/permissions")
def get_my_permissions(current_user: User = Depends(get_current_user)):
    """Return the set of permission strings the current user has.
    The frontend uses this to hide unauthorised actions."""
    return {"permissions": sorted(user_permissions(current_user))}
