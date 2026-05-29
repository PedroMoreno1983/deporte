"""
Password hashing + JWT tokens.

Note: we use `bcrypt` directly instead of `passlib.CryptContext` because
passlib 1.7.4 + bcrypt 4.x has a well-known issue where passlib can't
detect the bcrypt version and silently corrupts the verify step.
"""
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from .config import settings


# ── Password hashing ─────────────────────────────────────────────────────

# bcrypt accepts up to 72 bytes. Truncate just in case (very long passwords).
_BCRYPT_MAX_LEN = 72


def _to_bytes(s: str) -> bytes:
    b = s.encode("utf-8")
    return b[:_BCRYPT_MAX_LEN]


def get_password_hash(password: str) -> str:
    """Hash a plaintext password with bcrypt (cost=12)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(_to_bytes(password), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(_to_bytes(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ── JWT tokens ───────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
