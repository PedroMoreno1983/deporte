"""
Permission system — granular RBAC for Deporte FC.

Rationale: roles alone (admin/coach/kine/analyst) are too coarse. We map roles
to a set of *permission strings*; routes and UI features check by permission,
not by role. This keeps roles re-shapeable without touching every endpoint.

Permissions follow `<resource>:<action>`:
  players:read, players:write, players:delete
  injuries:read, injuries:write
  wellness:read, wellness:write
  matches:read, matches:write
  training:read, training:write
  tactical:read, tactical:write
  predictions:read
  analytics:read
  users:manage
  categories:manage
  audit:read

`require_permission(perm)` is a FastAPI dependency. The frontend has a mirror
table in `lib/permissions.ts` so UI can hide unauthorised actions.
"""
from __future__ import annotations

from typing import Set

from fastapi import Depends, HTTPException, status

from ..models.user import User, UserRole
from .deps import get_current_user


PERMISSIONS_BY_ROLE: dict[UserRole, Set[str]] = {
    UserRole.ADMIN: {
        "players:read", "players:write", "players:delete",
        "injuries:read", "injuries:write",
        "wellness:read", "wellness:write",
        "matches:read", "matches:write",
        "training:read", "training:write",
        "tactical:read", "tactical:write",
        "predictions:read",
        "analytics:read",
        "cv:read", "cv:upload", "cv:delete",
        "users:manage",
        "categories:manage",
        "audit:read",
    },
    UserRole.COACH: {
        "players:read", "players:write",
        "injuries:read",
        "wellness:read", "wellness:write",
        "matches:read", "matches:write",
        "training:read", "training:write",
        "tactical:read", "tactical:write",
        "predictions:read",
        "analytics:read",
        "cv:read", "cv:upload",
    },
    UserRole.KINESIOLOGIST: {
        "players:read",
        "injuries:read", "injuries:write",
        "wellness:read", "wellness:write",
        "training:read",
        "predictions:read",
    },
    UserRole.ANALYST: {
        "players:read",
        "injuries:read",
        "matches:read",
        "training:read",
        "tactical:read",
        "predictions:read",
        "analytics:read",
        "cv:read", "cv:upload",
    },
}


def user_permissions(user: User) -> Set[str]:
    """Effective permissions for `user`. Super-admins get everything."""
    if user.is_superadmin:
        # Union of all role perms
        return set().union(*PERMISSIONS_BY_ROLE.values())
    return PERMISSIONS_BY_ROLE.get(user.role, set())


def has_permission(user: User, permission: str) -> bool:
    return permission in user_permissions(user)


def require_permission(permission: str):
    """FastAPI dependency factory."""
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso requerido: {permission}",
            )
        return current_user
    return checker
