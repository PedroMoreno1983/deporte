"""End-to-end 2FA: enrolment, challenge login, recovery codes, disable.

Real HTTP through TestClient against an in-memory DB. Proves the whole flow a
client (web/mobile) would drive, plus that the TOTP secret is encrypted at rest.
"""
from __future__ import annotations

from sqlalchemy import text

from app.core import totp
from app.models.user import UserRole

API = "/api/v1/auth"


# ── helpers ───────────────────────────────────────────────────────────────────
def _login(client, email="coach@club.cl", password="Secret123!"):
    return client.post(f"{API}/login", json={"email": email, "password": password})


def _headers(client, email="coach@club.cl", password="Secret123!"):
    body = _login(client, email, password).json()
    return {"Authorization": f"Bearer {body['access_token']}"}


def _enroll(client, headers, secret_sink=None):
    """Run setup→enable and return (secret, recovery_codes)."""
    setup = client.post(f"{API}/mfa/setup", headers=headers).json()
    secret = setup["secret"]
    code = totp.get_totp(secret)
    enable = client.post(f"{API}/mfa/enable", headers=headers, json={"code": code})
    assert enable.status_code == 200, enable.text
    return secret, enable.json()["recovery_codes"]


# ── login without 2FA ──────────────────────────────────────────────────────────
def test_login_without_2fa_returns_tokens(client, make_user):
    make_user()
    r = _login(client)
    assert r.status_code == 200
    body = r.json()
    assert body["mfa_required"] is False
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["two_factor_enabled"] is False


def test_admin_login_flags_enrollment_required(client, make_user):
    make_user(email="admin@club.cl", role=UserRole.ADMIN)
    body = _login(client, "admin@club.cl").json()
    assert body["access_token"]
    assert body["mfa_enrollment_required"] is True   # privileged + not yet enrolled


def test_bad_password_401(client, make_user):
    make_user()
    r = _login(client, password="wrong")
    assert r.status_code == 401


# ── enrolment + challenge login ────────────────────────────────────────────────
def test_full_enrollment_then_challenge_login(client, make_user):
    make_user()
    headers = _headers(client)

    assert client.get(f"{API}/mfa/status", headers=headers).json()["enabled"] is False

    secret, recovery = _enroll(client, headers)
    assert len(recovery) == 10

    status_body = client.get(f"{API}/mfa/status", headers=headers).json()
    assert status_body["enabled"] is True
    assert status_body["recovery_codes_remaining"] == 10

    # Now login is two-step.
    login = _login(client).json()
    assert login["mfa_required"] is True
    assert login["mfa_token"] and login.get("access_token") is None

    verify = client.post(f"{API}/login/verify", json={
        "mfa_token": login["mfa_token"],
        "code": totp.get_totp(secret),
    })
    assert verify.status_code == 200
    assert verify.json()["access_token"]


def test_verify_rejects_wrong_code(client, make_user):
    make_user()
    headers = _headers(client)
    secret, _ = _enroll(client, headers)

    mfa_token = _login(client).json()["mfa_token"]
    real = totp.get_totp(secret)
    wrong = str((int(real[0]) + 1) % 10) + real[1:]
    r = client.post(f"{API}/login/verify", json={"mfa_token": mfa_token, "code": wrong})
    assert r.status_code == 401


def test_verify_rejects_tampered_token(client, make_user):
    make_user()
    headers = _headers(client)
    secret, _ = _enroll(client, headers)
    r = client.post(f"{API}/login/verify", json={"mfa_token": "not-a-jwt", "code": totp.get_totp(secret)})
    assert r.status_code == 401


# ── recovery codes ──────────────────────────────────────────────────────────────
def test_recovery_code_logs_in_and_is_consumed(client, make_user):
    make_user()
    headers = _headers(client)
    _secret, recovery = _enroll(client, headers)
    code = recovery[0]

    mfa_token = _login(client).json()["mfa_token"]
    ok = client.post(f"{API}/login/verify", json={"mfa_token": mfa_token, "code": code})
    assert ok.status_code == 200 and ok.json()["access_token"]

    # One fewer remaining, and the same code can't be reused.
    assert client.get(f"{API}/mfa/status", headers=headers).json()["recovery_codes_remaining"] == 9
    mfa_token2 = _login(client).json()["mfa_token"]
    reuse = client.post(f"{API}/login/verify", json={"mfa_token": mfa_token2, "code": code})
    assert reuse.status_code == 401


def test_regenerate_recovery_codes_invalidates_old(client, make_user):
    make_user()
    headers = _headers(client)
    secret, old = _enroll(client, headers)

    regen = client.post(f"{API}/mfa/recovery-codes", headers=headers, json={"code": totp.get_totp(secret)})
    assert regen.status_code == 200
    new = regen.json()["recovery_codes"]
    assert set(new).isdisjoint(set(old))

    # An old code no longer works at login.
    mfa_token = _login(client).json()["mfa_token"]
    r = client.post(f"{API}/login/verify", json={"mfa_token": mfa_token, "code": old[0]})
    assert r.status_code == 401


# ── guards ──────────────────────────────────────────────────────────────────────
def test_setup_conflicts_when_already_enabled(client, make_user):
    make_user()
    headers = _headers(client)
    _enroll(client, headers)
    r = client.post(f"{API}/mfa/setup", headers=headers)
    assert r.status_code == 409


def test_enable_with_wrong_code_400(client, make_user):
    make_user()
    headers = _headers(client)
    client.post(f"{API}/mfa/setup", headers=headers)
    r = client.post(f"{API}/mfa/enable", headers=headers, json={"code": "000000"})
    assert r.status_code == 400


def test_setup_requires_auth(client, make_user):
    make_user()
    assert client.post(f"{API}/mfa/setup").status_code in (401, 403)


# ── disable ───────────────────────────────────────────────────────────────────
def test_disable_requires_password_and_code(client, make_user):
    make_user()
    headers = _headers(client)
    secret, _ = _enroll(client, headers)

    # Wrong password → 400.
    assert client.post(f"{API}/mfa/disable", headers=headers,
                       json={"password": "nope", "code": totp.get_totp(secret)}).status_code == 400
    # Right password, missing code → 400.
    assert client.post(f"{API}/mfa/disable", headers=headers,
                       json={"password": "Secret123!"}).status_code == 400
    # Both correct → 204 and 2FA is off.
    ok = client.post(f"{API}/mfa/disable", headers=headers,
                     json={"password": "Secret123!", "code": totp.get_totp(secret)})
    assert ok.status_code == 204
    assert client.get(f"{API}/mfa/status", headers=headers).json()["enabled"] is False
    # Login is single-step again.
    assert _login(client).json()["mfa_required"] is False


# ── encryption at rest ──────────────────────────────────────────────────────────
def test_totp_secret_is_encrypted_at_rest(client, make_user, db_session):
    user = make_user()
    headers = _headers(client)
    setup = client.post(f"{API}/mfa/setup", headers=headers).json()
    plaintext_secret = setup["secret"]

    db = db_session()
    try:
        raw = db.execute(
            text("SELECT totp_secret FROM users WHERE id = :id"), {"id": user.id}
        ).scalar_one()
    finally:
        db.close()

    assert raw is not None
    assert raw.startswith("enc:v1:")          # stored encrypted
    assert plaintext_secret not in raw         # plaintext never hits the DB
