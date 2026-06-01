"""Application-level encryption at rest for sensitive columns.

Backed by Fernet (AES-128-CBC + HMAC-SHA256, from the ``cryptography`` package
that ``python-jose[cryptography]`` already pulls in). Used for:
  - 2FA shared secrets            (compliance #11)
  - protected health information   (compliance #12 — Ley 21.719 / datos sensibles)

Key resolution, in order:
  1. ``settings.DATA_ENCRYPTION_KEY`` — a urlsafe-base64 32-byte Fernet key.
     **Set this in production** (e.g. ``python -c "from cryptography.fernet
     import Fernet; print(Fernet.generate_key().decode())"``).
  2. Otherwise derive a key deterministically from ``SECRET_KEY`` via SHA-256,
     so development works with no extra config. (Rotating ``SECRET_KEY`` then
     rotates the data key — never do that with live ciphertext in the DB.)

Ciphertext is tagged with a versioned prefix so we can (a) detect already-
encrypted values, (b) tolerate legacy plaintext during a backfill, and (c) roll
the scheme forward later without ambiguity.
"""
from __future__ import annotations

import base64
import hashlib
from functools import lru_cache
from typing import Optional

from sqlalchemy.types import Text, TypeDecorator

from .config import settings

_PREFIX = "enc:v1:"


@lru_cache(maxsize=1)
def _fernet():
    """Build (once) the Fernet instance from configured/derived key material."""
    from cryptography.fernet import Fernet  # lazy: keep model import dependency-free

    configured = (settings.DATA_ENCRYPTION_KEY or "").strip()
    if configured:
        try:
            # Accept a ready-made urlsafe-base64 32-byte Fernet key as-is.
            return Fernet(configured.encode("ascii"))
        except (ValueError, TypeError):
            material = configured.encode("utf-8")  # treat as a passphrase
    else:
        material = (settings.SECRET_KEY or "").encode("utf-8")

    derived = base64.urlsafe_b64encode(hashlib.sha256(material).digest())
    return Fernet(derived)


def reset_key_cache() -> None:
    """Drop the cached Fernet (after changing keys in tests/key rotation)."""
    _fernet.cache_clear()


def is_encrypted(value: object) -> bool:
    """True iff ``value`` is one of our tagged ciphertext strings."""
    return isinstance(value, str) and value.startswith(_PREFIX)


def encrypt(plaintext: str) -> str:
    """Encrypt a string, returning a tagged, URL-safe token."""
    token = _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")
    return _PREFIX + token


def decrypt(value: str) -> str:
    """Decrypt a tagged token. Plaintext (untagged legacy rows) passes through."""
    if not is_encrypted(value):
        return value  # tolerate values written before encryption was enabled
    token = value[len(_PREFIX):]
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")


class EncryptedString(TypeDecorator):
    """A ``Text`` column transparently encrypted on write, decrypted on read.

    The Python attribute is always plaintext; the database only ever stores
    ciphertext. Because Fernet is non-deterministic you cannot ``WHERE`` on an
    encrypted column — only use this for values you fetch by row, never filter by.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Optional[str], dialect) -> Optional[str]:
        if value is None:
            return None
        return encrypt(str(value))

    def process_result_value(self, value: Optional[str], dialect) -> Optional[str]:
        if value is None:
            return None
        return decrypt(value)
