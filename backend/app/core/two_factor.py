"""2FA service layer — enrolment, verification and recovery-code lifecycle.

Sits between the pure RFC core (``totp``) and the endpoints. Operates on a
``User`` row in place (the caller owns the DB ``commit``), which keeps the HTTP
handlers thin and lets this logic be unit-tested with a lightweight user stub.

Recovery codes are stored as bcrypt hashes (via ``security``) and consumed
one-shot; the plaintext is shown to the user exactly once at generation.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from . import totp
from .config import settings
from .security import get_password_hash, verify_password


def _hash_codes(plain: List[str]) -> List[str]:
    return [get_password_hash(totp.normalize_recovery_code(c)) for c in plain]


def begin_enrollment(user) -> tuple[str, str]:
    """Store a fresh *unconfirmed* secret on the user; return (secret, otpauth_uri).

    Re-enrolling overwrites any pending (or even active) secret — 2FA only turns
    on once :func:`confirm_enrollment` proves the user holds the new secret.
    """
    secret = totp.generate_totp_secret()
    user.totp_secret = secret
    user.totp_enabled = False
    user.totp_confirmed_at = None
    user.totp_recovery_codes = None
    uri = totp.provisioning_uri(secret, user.email, settings.MFA_ISSUER)
    return secret, uri


def confirm_enrollment(user, code: str) -> Optional[List[str]]:
    """Verify ``code`` against the pending secret. On success enable 2FA and
    return freshly minted recovery codes (plaintext, one-time). Else ``None``."""
    if not user.totp_secret or not totp.verify_totp(user.totp_secret, code):
        return None
    plain = totp.generate_recovery_codes()
    user.totp_recovery_codes = _hash_codes(plain)
    user.totp_enabled = True
    user.totp_confirmed_at = datetime.utcnow()
    return plain


def verify_totp_code(user, code: str) -> bool:
    """True if ``code`` is a valid TOTP for an enrolled user (consumes nothing)."""
    return bool(user.totp_enabled and user.totp_secret and totp.verify_totp(user.totp_secret, code))


def consume_recovery_code(user, code: str) -> bool:
    """If ``code`` matches an unused recovery hash, remove it and return True."""
    stored = user.totp_recovery_codes or []
    target = totp.normalize_recovery_code(code)
    if not target:
        return False
    remaining = list(stored)
    for i, h in enumerate(remaining):
        if verify_password(target, h):
            remaining.pop(i)
            user.totp_recovery_codes = remaining  # reassign so SQLAlchemy tracks it
            return True
    return False


def verify_second_factor(user, code: str) -> Optional[str]:
    """Login second step: accept a TOTP *or* a recovery code.

    Returns the method used (``"totp"`` / ``"recovery"``) or ``None``. Recovery
    codes are consumed on use; TOTP codes are not.
    """
    if verify_totp_code(user, code):
        return "totp"
    if consume_recovery_code(user, code):
        return "recovery"
    return None


def regenerate_recovery_codes(user) -> List[str]:
    """Replace all recovery codes; return the new plaintext set (one-time)."""
    plain = totp.generate_recovery_codes()
    user.totp_recovery_codes = _hash_codes(plain)
    return plain


def disable(user) -> None:
    """Fully clear 2FA state (turns the second factor off)."""
    user.totp_secret = None
    user.totp_enabled = False
    user.totp_confirmed_at = None
    user.totp_recovery_codes = None


def recovery_codes_remaining(user) -> int:
    return len(user.totp_recovery_codes or [])
