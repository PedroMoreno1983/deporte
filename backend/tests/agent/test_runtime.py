"""Agent runtime: tool-calling loop mechanics (no real LLM, no DB).

Pure-python — uses FakeProvider + injected tools so it always runs fast.
"""
from __future__ import annotations

from app.agent.provider import FakeProvider, ToolCall, _ScriptedTurn
from app.agent.runtime import run_agent, SYSTEM_PROMPT
from app.agent.tools import Tool


def _echo_tool(calls: list) -> Tool:
    def run(db, user, args):
        calls.append(args)
        return {"echo": args}
    return Tool("eco", "Devuelve sus argumentos.",
                {"type": "object", "properties": {"x": {"type": "integer"}}}, run)


def test_loop_executes_tool_then_answers():
    seen: list = []
    provider = FakeProvider([
        _ScriptedTurn(tool_calls=[ToolCall(id="c1", name="eco", arguments={"x": 7})]),
        _ScriptedTurn(content="El valor es 7."),
    ])
    res = run_agent(
        [{"role": "user", "content": "decime x"}],
        db=None, current_user=None, provider=provider, tools=[_echo_tool(seen)],
    )
    assert res.reply == "El valor es 7."
    assert res.iterations == 2
    assert seen == [{"x": 7}]                      # the tool actually ran
    assert res.tool_calls == [{"tool": "eco", "args": {"x": 7}, "result": {"echo": {"x": 7}}}]


def test_unknown_tool_is_reported_not_crashed():
    provider = FakeProvider([
        _ScriptedTurn(tool_calls=[ToolCall(id="c1", name="no_existe", arguments={})]),
        _ScriptedTurn(content="listo"),
    ])
    res = run_agent([{"role": "user", "content": "x"}], db=None, current_user=None,
                    provider=provider, tools=[])
    assert res.tool_calls[0]["result"]["error"].startswith("herramienta desconocida")
    assert res.reply == "listo"


def test_tool_exception_is_caught():
    def boom(db, user, args):
        raise ValueError("kaboom")
    res = run_agent(
        [{"role": "user", "content": "x"}], db=None, current_user=None,
        provider=FakeProvider([
            _ScriptedTurn(tool_calls=[ToolCall(id="c1", name="boom", arguments={})]),
            _ScriptedTurn(content="ok"),
        ]),
        tools=[Tool("boom", "rompe", {"type": "object", "properties": {}}, boom)],
    )
    assert "fallo ejecutando boom" in res.tool_calls[0]["result"]["error"]
    assert res.reply == "ok"


def test_immediate_answer_no_tools():
    res = run_agent([{"role": "user", "content": "hola"}], db=None, current_user=None,
                    provider=FakeProvider([_ScriptedTurn(content="¡Hola!")]), tools=[])
    assert res.reply == "¡Hola!"
    assert res.iterations == 1
    assert res.tool_calls == []


def test_step_cap_does_not_loop_forever():
    # Provider always asks for a tool → must stop at max_iters.
    turns = [_ScriptedTurn(tool_calls=[ToolCall(id=f"c{i}", name="eco", arguments={})]) for i in range(20)]
    res = run_agent([{"role": "user", "content": "x"}], db=None, current_user=None,
                    provider=FakeProvider(turns), tools=[_echo_tool([])], max_iters=3)
    assert res.iterations == 3
    assert len(res.tool_calls) == 3


def test_system_prompt_encodes_anti_hallucination_guardrails():
    p = SYSTEM_PROMPT.lower()
    assert "nunca inventes" in p
    assert "herramienta" in p
