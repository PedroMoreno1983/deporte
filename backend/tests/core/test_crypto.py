"""At-rest encryption (Fernet) — round-trips, tagging, and the column type.

Needs the ``cryptography`` package (shipped via python-jose[cryptography]); it's
present in this env, so these run. SECRET_KEY comes from the repo .env, which is
enough to derive the dev key.
"""
from __future__ import annotations

import pytest

from app.core import crypto


def test_round_trip_and_nondeterministic():
    plaintext = "JBSWY3DPEHPK3PXP"  # looks like a TOTP secret
    a = crypto.encrypt(plaintext)
    b = crypto.encrypt(plaintext)
    assert a != plaintext and b != plaintext       # actually encrypted
    assert a != b                                  # Fernet nonce → distinct ciphertexts
    assert crypto.decrypt(a) == plaintext
    assert crypto.decrypt(b) == plaintext


def test_tagging_and_detection():
    token = crypto.encrypt("hello")
    assert token.startswith("enc:v1:")
    assert crypto.is_encrypted(token)
    assert not crypto.is_encrypted("hello")
    assert not crypto.is_encrypted(None)


def test_decrypt_passes_through_legacy_plaintext():
    # Rows written before encryption was enabled must still read back.
    assert crypto.decrypt("legacy-plaintext") == "legacy-plaintext"


def test_unicode_round_trip():
    s = "Niño — kinesiología ✅"
    assert crypto.decrypt(crypto.encrypt(s)) == s


def test_encrypted_string_type_decorator():
    col = crypto.EncryptedString()
    stored = col.process_bind_param("secret-value", dialect=None)
    assert stored is not None and stored.startswith("enc:v1:")
    assert col.process_result_value(stored, dialect=None) == "secret-value"
    # None passes straight through both directions.
    assert col.process_bind_param(None, dialect=None) is None
    assert col.process_result_value(None, dialect=None) is None
