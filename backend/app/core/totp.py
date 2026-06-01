"""RFC 6238 TOTP + recovery codes — pure-python, zero dependencies.

Implementing the algorithm directly (instead of pulling ``pyotp``) keeps the
2FA core importable and unit-testable everywhere, and — more importantly — lets
us prove correctness against the *official RFC 6238 Appendix B test vectors*
(see ``tests/core/test_totp.py``). Same secrets/codes interoperate with Google
Authenticator, Authy, 1Password, Microsoft Authenticator, etc.

Public surface:
  - generate_totp_secret()    → new base32 shared secret
  - get_totp(secret)          → the current 6-digit code (for tests/QimI)
  - verify_totp(secret, code) → constant-time check with a clock-skew window
  - provisioning_uri(...)     → otpauth:// URI to render as a QR for enrolment
  - generate_recovery_codes() / normalize_recovery_code() → one-time backups
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import struct
import time
from typing import List, Optional
from urllib.parse import quote, urlencode

# ── defaults (match every mainstream authenticator app) ──────────────────────
DEFAULT_DIGITS = 6
DEFAULT_PERIOD = 30          # seconds per code
DEFAULT_ALGORITHM = "SHA1"

_HASHERS = {"SHA1": hashlib.sha1, "SHA256": hashlib.sha256, "SHA512": hashlib.sha512}
_WHITESPACE = re.compile(r"\s+")


# ── secret handling ──────────────────────────────────────────────────────────
def generate_totp_secret(length_bytes: int = 20) -> str:
    """Return a fresh base32 secret (default 160-bit, the RFC 4226 recommendation).

    Padding ``=`` is stripped so it pastes cleanly into authenticator apps; the
    decoder re-pads on the way back in.
    """
    raw = secrets.token_bytes(length_bytes)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _decode_secret(secret: str) -> bytes:
    """Base32-decode a (possibly unpadded, spaced, lowercase) shared secret."""
    cleaned = _WHITESPACE.sub("", secret).upper()
    if not cleaned:
        raise ValueError("empty TOTP secret")
    pad = (-len(cleaned)) % 8
    return base64.b32decode(cleaned + ("=" * pad), casefold=True)


# ── HOTP / TOTP core (RFC 4226 / RFC 6238) ───────────────────────────────────
def _hotp(secret: str, counter: int, *, digits: int, algorithm: str) -> str:
    key = _decode_secret(secret)
    hasher = _HASHERS[algorithm.upper()]
    mac = hmac.new(key, struct.pack(">Q", counter), hasher).digest()
    offset = mac[-1] & 0x0F                                   # dynamic truncation
    truncated = struct.unpack(">I", mac[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(truncated % (10 ** digits)).zfill(digits)


def get_totp(
    secret: str,
    *,
    timestamp: Optional[float] = None,
    period: int = DEFAULT_PERIOD,
    digits: int = DEFAULT_DIGITS,
    algorithm: str = DEFAULT_ALGORITHM,
) -> str:
    """The TOTP code for ``timestamp`` (defaults to now)."""
    ts = time.time() if timestamp is None else timestamp
    counter = int(ts // period)
    return _hotp(secret, counter, digits=digits, algorithm=algorithm)


def verify_totp(
    secret: str,
    code: str,
    *,
    timestamp: Optional[float] = None,
    period: int = DEFAULT_PERIOD,
    digits: int = DEFAULT_DIGITS,
    algorithm: str = DEFAULT_ALGORITHM,
    valid_window: int = 1,
) -> bool:
    """Constant-time TOTP check, tolerating ``±valid_window`` steps of clock skew.

    A window of 1 accepts the previous, current and next code (~90 s total),
    which absorbs phone/server clock drift without meaningfully widening the
    attack surface.
    """
    if not secret or code is None:
        return False
    candidate = _WHITESPACE.sub("", str(code))
    if not candidate.isdigit():
        return False
    candidate = candidate.zfill(digits)

    ts = time.time() if timestamp is None else timestamp
    counter = int(ts // period)
    ok = False
    # Iterate the whole window (no early return) so timing doesn't leak which
    # step matched.
    for drift in range(-valid_window, valid_window + 1):
        if counter + drift < 0:
            continue
        expected = _hotp(secret, counter + drift, digits=digits, algorithm=algorithm)
        if hmac.compare_digest(expected, candidate):
            ok = True
    return ok


def provisioning_uri(
    secret: str,
    account_name: str,
    issuer: str,
    *,
    period: int = DEFAULT_PERIOD,
    digits: int = DEFAULT_DIGITS,
    algorithm: str = DEFAULT_ALGORITHM,
) -> str:
    """Build the ``otpauth://totp/...`` URI an authenticator app scans as a QR."""
    label = quote(f"{issuer}:{account_name}", safe="")
    params = {
        "secret": secret,
        "issuer": issuer,
        "algorithm": algorithm.upper(),
        "digits": digits,
        "period": period,
    }
    return f"otpauth://totp/{label}?{urlencode(params)}"


# ── recovery (backup) codes ───────────────────────────────────────────────────
# Crockford-ish alphabet: no 0/O/1/I to avoid transcription errors.
_RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_recovery_codes(count: int = 10, *, groups: int = 2, group_len: int = 5) -> List[str]:
    """Return ``count`` human-friendly one-time codes like ``ABCDE-FGHJK``.

    Each code carries ``groups*group_len*log2(32)`` bits of entropy (50 bits at
    the defaults) — far beyond brute-forcing a rate-limited login.
    """
    codes: List[str] = []
    for _ in range(count):
        parts = [
            "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(group_len))
            for _ in range(groups)
        ]
        codes.append("-".join(parts))
    return codes


def normalize_recovery_code(code: str) -> str:
    """Strip formatting/case so ``abcde-fghjk`` and ``ABCDEFGHJK`` compare equal."""
    return re.sub(r"[^A-Z0-9]", "", str(code).upper())
