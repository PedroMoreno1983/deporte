from __future__ import annotations

from app.agent.provider import GeminiProvider


def test_gemini_provider_uses_current_default_model_and_auth_header(monkeypatch):
    seen = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "OK", "tool_calls": []}}]}

    def fake_post(url, *, headers, json, timeout):
        seen["url"] = url
        seen["headers"] = headers
        seen["payload"] = json
        seen["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("httpx.post", fake_post)

    res = GeminiProvider(api_key="gemini-secret").chat(
        messages=[{"role": "user", "content": "hola"}],
        tools=[],
    )

    assert res.content == "OK"
    assert seen["url"] == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    assert "gemini-secret" not in seen["url"]
    assert seen["headers"]["Authorization"] == "Bearer gemini-secret"
    assert seen["payload"]["model"] == "gemini-3.5-flash"