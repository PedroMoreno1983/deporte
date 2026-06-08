"""Agent runtime: a bounded tool-calling loop over real, club-scoped tools.

The loop asks the LLM; if it requests tools, we execute them against the
database (scoped to the caller's club) and feed the results back; we repeat
until the model produces a final answer or we hit the step cap. Every tool
result is recorded in a trace so the UI can show *which data* backed the answer
— the transparency half of the anti-hallucination story.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from .provider import LLMProvider
from .tools import Tool, build_tools, to_openai_specs

SYSTEM_PROMPT = (
    "Sos el analista de datos del cuerpo técnico en la plataforma Deporte FC. "
    "Respondés en español neutro, claro, breve y accionable.\n\n"
    "REGLAS DURAS (no negociables):\n"
    "1. Solo afirmás datos (números, nombres, resultados, riesgos) que provengan de una "
    "herramienta en ESTA conversación. NUNCA inventes estadísticas, nombres de jugadores, "
    "resultados ni valores. Si no lo trajo una herramienta, no lo digas.\n"
    "2. Si para responder necesitás un dato, LLAMÁ a la herramienta correspondiente; no supongas.\n"
    "3. Para hablar de un jugador o partido puntual, primero obtené su id con "
    "`listar_jugadores` o `listar_partidos`.\n"
    "4. Si una herramienta devuelve un error o no hay datos, decílo con honestidad "
    "('no tengo ese dato'); no rellenes el hueco inventando.\n"
    "5. Todos los datos ya vienen filtrados a TU club. Citá los números concretos que te "
    "dan las herramientas y cerrá con una recomendación práctica cuando aplique."
)


@dataclass
class AgentResult:
    reply: str
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)  # trace
    iterations: int = 0


def run_agent(
    messages: List[Dict[str, str]],
    *,
    db: Session,
    current_user: Any,
    provider: LLMProvider,
    max_iters: int = 6,
    tools: Optional[List[Tool]] = None,
) -> AgentResult:
    """Run the agent over ``messages`` (a list of ``{role, content}``)."""
    tools = build_tools() if tools is None else tools
    tool_by_name = {t.name: t for t in tools}
    specs = to_openai_specs(tools)

    convo: List[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in messages[-12:]:
        role = m.get("role") if m.get("role") in ("user", "assistant") else "user"
        convo.append({"role": role, "content": str(m.get("content", ""))})

    trace: List[Dict[str, Any]] = []
    last_content = ""
    for i in range(max_iters):
        resp = provider.chat(convo, specs)
        last_content = resp.content or last_content
        if not resp.tool_calls:
            return AgentResult(reply=resp.content or "", tool_calls=trace, iterations=i + 1)

        # Record the assistant's tool-call turn in OpenAI message format.
        convo.append({
            "role": "assistant",
            "content": resp.content or "",
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.name, "arguments": json.dumps(tc.arguments, ensure_ascii=False)}}
                for tc in resp.tool_calls
            ],
        })
        for tc in resp.tool_calls:
            tool = tool_by_name.get(tc.name)
            if tool is None:
                result: Any = {"error": f"herramienta desconocida: {tc.name}"}
            else:
                try:
                    result = tool.run(db, current_user, tc.arguments)
                except Exception as exc:  # noqa: BLE001 — a tool bug must not crash the chat
                    result = {"error": f"fallo ejecutando {tc.name}: {exc}"}
            trace.append({"tool": tc.name, "args": tc.arguments, "result": result})
            convo.append({
                "role": "tool", "tool_call_id": tc.id,
                "content": json.dumps(result, ensure_ascii=False, default=str),
            })

    # Hit the step cap — surface whatever the model last said, honestly.
    return AgentResult(
        reply=last_content or "No pude completar la consulta dentro del límite de pasos.",
        tool_calls=trace, iterations=max_iters,
    )
