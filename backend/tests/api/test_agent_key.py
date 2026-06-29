from __future__ import annotations

from app.agent.provider import ProviderResponse
from app.models.club import Club
from app.models.user import UserRole

API = "/api/v1"


def _headers(client, make_user, *, club_id: int = 1):
    make_user(
        email="admin@club.cl",
        password="Secret123!",
        role=UserRole.ADMIN,
        club_id=club_id,
    )
    login = client.post(
        f"{API}/auth/login",
        json={"email": "admin@club.cl", "password": "Secret123!"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_test_key_can_use_saved_club_gemini_key(client, make_user, db_session, monkeypatch):
    db = db_session()
    try:
        db.add(Club(
            id=42,
            name="Deporte FC",
            slug="deporte-fc",
            ai_provider="gemini",
            ai_api_key="real-gemini-key",
            ai_model="gemini-3.5-flash",
        ))
        db.commit()
    finally:
        db.close()

    seen = {}

    class FakeGeminiProvider:
        def __init__(self, api_key: str, model: str, **kwargs):
            seen["api_key"] = api_key
            seen["model"] = model

        def chat(self, messages, tools):
            seen["messages"] = messages
            return ProviderResponse(content="OK")

    monkeypatch.setattr("app.agent.provider.GeminiProvider", FakeGeminiProvider)

    r = client.post(
        f"{API}/agent/test-key",
        headers=_headers(client, make_user, club_id=42),
        json={"provider": "gemini", "api_key": "EXISTING", "model": ""},
    )

    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True, "reply": "OK"}
    assert seen["api_key"] == "real-gemini-key"
    assert seen["model"] == "gemini-3.5-flash"


def test_test_key_requires_saved_key_when_using_existing(client, make_user, db_session):
    db = db_session()
    try:
        db.add(Club(id=43, name="Sin IA", slug="sin-ia"))
        db.commit()
    finally:
        db.close()

    r = client.post(
        f"{API}/agent/test-key",
        headers=_headers(client, make_user, club_id=43),
        json={"provider": "gemini", "api_key": "EXISTING", "model": ""},
    )

    assert r.status_code == 400
    assert "No hay una clave" in r.json()["detail"]