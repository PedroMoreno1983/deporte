from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .security import decode_token
from ..models.user import User, UserRole
from ..models.player import Player

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado o inactivo")
    return user


def require_roles(*roles: UserRole):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
        return current_user
    return checker


def get_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol de administrador")
    return current_user


def get_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere super-administrador")
    return current_user


def get_current_club_id(current_user: User = Depends(get_current_user)) -> int:
    """Resolve the active club for the current request.

    Regular users are scoped to their assigned `club_id`. Super-admins can pass
    `X-Club-Id` header (not implemented here yet) — for now they must also have
    a `club_id` set, otherwise we 400. This keeps the data layer simple.
    """
    if current_user.club_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario sin club asignado",
        )
    return current_user.club_id


def scoped_query(query, model, current_user: User):
    """Apply tenant scoping to `query` filtering `model.club_id` when present.

    Super-admins skip scoping (cross-club view).
    """
    if current_user.is_superadmin:
        return query
    if hasattr(model, "club_id"):
        return query.filter(model.club_id == current_user.club_id)
    return query


def get_player_in_club(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Player:
    """Resolve a player *within the caller's club* or 404.

    Use as a dependency on any ``/.../player/{player_id}/...`` route to stop one
    club reading another club's player data (wellness, kinesiology, predictions,
    stats…). Returns 404 (not 403) so player ids aren't enumerable cross-club.
    """
    player = scoped_query(db.query(Player), Player, current_user).filter(
        Player.id == player_id
    ).first()
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jugador no encontrado")
    return player
