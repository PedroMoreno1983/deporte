"""LLM provider abstraction for the agent runtime.

Wraps the chat-completions + tool-calling API behind a tiny interface so the
runtime is testable (``FakeProvider``) and the vendor is swappable. The default
is Groq (already used by the tactical assistant), which is OpenAI-compatible for
function calling.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Dict[str, Any]


@dataclass
class ProviderResponse:
    content: Optional[str]
    tool_calls: List[ToolCall] = field(default_factory=list)


class LLMProvider(Protocol):
    def chat(self, messages: List[dict], tools: List[dict]) -> ProviderResponse:  # pragma: no cover
        ...


class GroqProvider:
    """Groq chat-completions with tool calling (Llama 3.x ``*-versatile``)."""

    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile",
                 temperature: float = 0.2, max_tokens: int = 1024) -> None:
        from groq import Groq  # imported lazily so the package loads without groq
        self._client = Groq(api_key=api_key)
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens

    def chat(self, messages: List[dict], tools: List[dict]) -> ProviderResponse:
        kwargs: Dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": self._temperature,
            "max_tokens": self._max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        resp = self._client.chat.completions.create(**kwargs)
        msg = resp.choices[0].message
        calls: List[ToolCall] = []
        for tc in (getattr(msg, "tool_calls", None) or []):
            try:
                args = json.loads(tc.function.arguments or "{}")
            except (json.JSONDecodeError, TypeError):
                args = {}
            calls.append(ToolCall(id=tc.id, name=tc.function.name, arguments=args))
        return ProviderResponse(content=msg.content, tool_calls=calls)


@dataclass
class _ScriptedTurn:
    """One scripted model turn for tests: either tool calls or a final answer."""
    content: Optional[str] = None
    tool_calls: List[ToolCall] = field(default_factory=list)


class FakeProvider:
    """Deterministic provider for unit tests — replays a script of turns."""

    def __init__(self, turns: List[_ScriptedTurn]) -> None:
        self._turns = list(turns)
        self.calls_seen: List[List[dict]] = []

    def chat(self, messages: List[dict], tools: List[dict]) -> ProviderResponse:
        self.calls_seen.append(messages)
        turn = self._turns.pop(0) if self._turns else _ScriptedTurn(content="(sin más respuestas)")
        return ProviderResponse(content=turn.content, tool_calls=list(turn.tool_calls))
