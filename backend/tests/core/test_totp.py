"""TOTP core — proven against the official RFC 6238 Appendix B test vectors.

If these pass, our generator is bit-for-bit interoperable with Google
Authenticator / Authy / 1Password etc. Everything here is pure-python (no cv2,
no DB), so it always runs.
"""
from __future__ import annotations

import base64

from app.core import totp

# RFC 6238 Appendix B shared secrets (ASCII seeds → base32 as our API stores them).
_SECRET_SHA1 = base64.b32encode(b"12345678901234567890").decode()
_SECRET_SHA256 = base64.b32encode(b"12345678901234567890123456789012").decode()
_SECRET_SHA512 = base64.b32encode(
    b"1234567890123456789012345678901234567890123456789012345678901234"
).decode()

# (unix_time, expected 8-digit code) — the SHA1 column of the RFC table.
_RFC_SHA1 = [
    (59, "94287082"),
    (1111111109, "07081804"),
    (1111111111, "14050471"),
    (1234567890, "89005924"),
    (2000000000, "69279037"),
    (20000000000, "65353130"),
]


# ── RFC 6238 vectors ─────────────────────────────────────────────────────────
def test_rfc6238_sha1_vectors():
    for ts, expected in _RFC_SHA1:
        got = totp.get_totp(_SECRET_SHA1, timestamp=ts, digits=8, algorithm="SHA1")
        assert got == expected, f"t={ts}: {got} != {expected}"


def test_rfc6238_sha256_and_sha512_vectors():
    assert totp.get_totp(_SECRET_SHA256, timestamp=59, digits=8, algorithm="SHA256") == "46119246"
    assert totp.get_totp(_SECRET_SHA512, timestamp=59, digits=8, algorithm="SHA512") == "90693936"
    assert totp.get_totp(_SECRET_SHA256, timestamp=1234567890, digits=8, algorithm="SHA256") == "91819424"


# ── secret generation ─────────────────────────────────────────────────────────
def test_generate_secret_is_decodable_base32_and_random():
    s1, s2 = totp.generate_totp_secret(), totp.generate_totp_secret()
    assert s1 != s2
    # 20 random bytes → 32 base32 chars (no padding).
    assert len(s1) == 32 and set(s1) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")
    assert len(totp._decode_secret(s1)) == 20


# ── verification window ───────────────────────────────────────────────────────
def test_verify_accepts_current_and_adjacent_steps():
    secret = totp.generate_totp_secret()
    base = 1_000_000_000  # arbitrary fixed instant
    now = totp.get_totp(secret, timestamp=base)
    prev = totp.get_totp(secret, timestamp=base - 30)
    nxt = totp.get_totp(secret, timestamp=base + 30)
    assert totp.verify_totp(secret, now, timestamp=base)
    assert totp.verify_totp(secret, prev, timestamp=base)     # clock skew −1 step
    assert totp.verify_totp(secret, nxt, timestamp=base)      # clock skew +1 step


def test_verify_rejects_distant_step_and_garbage():
    secret = totp.generate_totp_secret()
    base = 1_000_000_000
    two_ago = totp.get_totp(secret, timestamp=base - 60)      # 2 steps away → outside window
    assert not totp.verify_totp(secret, two_ago, timestamp=base)
    # A deterministically-wrong code: real code with its first digit bumped.
    real = totp.get_totp(secret, timestamp=base)
    wrong = str((int(real[0]) + 1) % 10) + real[1:]
    assert not totp.verify_totp(secret, wrong, timestamp=base)
    assert not totp.verify_totp(secret, "abc", timestamp=base)
    assert not totp.verify_totp(secret, "", timestamp=base)
    assert not totp.verify_totp("", "123456", timestamp=base)


def test_verify_tolerates_spaces_and_leading_zero():
    secret = totp.generate_totp_secret()
    base = 1_000_000_000
    code = totp.get_totp(secret, timestamp=base)
    spaced = f"{code[:3]} {code[3:]}"
    assert totp.verify_totp(secret, spaced, timestamp=base)


# ── provisioning URI ──────────────────────────────────────────────────────────
def test_provisioning_uri_shape():
    uri = totp.provisioning_uri("ABCDEF", "coach@club.cl", "Deporte FC")
    assert uri.startswith("otpauth://totp/")
    assert "secret=ABCDEF" in uri
    assert "issuer=Deporte+FC" in uri
    assert "algorithm=SHA1" in uri and "digits=6" in uri and "period=30" in uri
    # account + issuer in the label, url-encoded.
    assert "Deporte%20FC%3Acoach%40club.cl" in uri


# ── recovery codes ────────────────────────────────────────────────────────────
def test_recovery_codes_unique_formatted_and_unambiguous():
    codes = totp.generate_recovery_codes(10)
    assert len(codes) == 10 == len(set(codes))
    for c in codes:
        a, b = c.split("-")
        assert len(a) == 5 and len(b) == 5
        assert set(c.replace("-", "")) <= set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")  # no 0/O/1/I


def test_normalize_recovery_code():
    assert totp.normalize_recovery_code("abcde-fghjk") == "ABCDEFGHJK"
    assert totp.normalize_recovery_code(" AB CD-EF ") == "ABCDEF"
