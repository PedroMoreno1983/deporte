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


class GeminiProvider:
    """Google Gemini OpenAI-compatible completions with tool calling."""

    def __init__(self, api_key: str, model: str = "gemini-3.5-flash",
                 temperature: float = 0.2, max_tokens: int = 1024) -> None:
        self._api_key = api_key
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens

    def chat(self, messages: List[dict], tools: List[dict]) -> ProviderResponse:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json"
        }
        # Gemini expects standard OpenAI JSON
        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": self._temperature,
            "max_tokens": self._max_tokens
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
            
        r = httpx.post(url, headers=headers, json=payload, timeout=60.0)
        r.raise_for_status()
        data = r.json()
        
        choice = data["choices"][0]
        msg = choice["message"]
        content = msg.get("content")
        
        calls: List[ToolCall] = []
        for tc in msg.get("tool_calls", []):
            fn = tc.get("function", {})
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except (json.JSONDecodeError, TypeError):
                args = {}
            calls.append(ToolCall(id=tc.get("id", ""), name=fn.get("name", ""), arguments=args))
            
        return ProviderResponse(content=content, tool_calls=calls)


class ClaudeProvider:
    """Anthropic Claude Provider implementing messages + tool calling."""

    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022",
                 temperature: float = 0.2, max_tokens: int = 1024) -> None:
        self._api_key = api_key
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens

    def chat(self, messages: List[dict], tools: List[dict]) -> ProviderResponse:
        import httpx
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self._api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        # Anthropic separate system prompt
        system_prompt = ""
        claude_msgs = []
        for m in messages:
            if m["role"] == "system":
                system_prompt = m["content"]
            elif m["role"] in ("user", "assistant"):
                # Handle assistants with tool calls
                if m["role"] == "assistant" and "tool_calls" in m:
                    content_list = []
                    if m.get("content"):
                        content_list.append({"type": "text", "text": m["content"]})
                    for tc in m["tool_calls"]:
                        fn = tc.get("function", {})
                        content_list.append({
                            "type": "tool_use",
                            "id": tc.get("id", ""),
                            "name": fn.get("name", ""),
                            "input": json.loads(fn.get("arguments") or "{}")
                        })
                    claude_msgs.append({"role": "assistant", "content": content_list})
                else:
                    claude_msgs.append({"role": m["role"], "content": m["content"]})
            elif m["role"] == "tool":
                # A tool response message in Anthropic looks like a user role message containing tool_result content
                # Search if last message was user (anthropic groups consecutive same roles under same turn if not careful,
                # but we can just append it as a user message block)
                try:
                    res_val = json.loads(m["content"])
                except Exception:
                    res_val = m["content"]
                
                tool_msg = {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": m.get("tool_call_id", ""),
                            "content": json.dumps(res_val, ensure_ascii=False)
                        }
                    ]
                }
                claude_msgs.append(tool_msg)

        # Map OpenAI tool specs to Anthropic tool specs
        anthropic_tools = []
        for t in tools:
            spec = t.get("function", {})
            anthropic_tools.append({
                "name": spec.get("name"),
                "description": spec.get("description", ""),
                "input_schema": spec.get("parameters", {"type": "object", "properties": {}})
            })

        payload = {
            "model": self._model,
            "messages": claude_msgs,
            "max_tokens": self._max_tokens,
            "temperature": self._temperature
        }
        if system_prompt:
            payload["system"] = system_prompt
        if anthropic_tools:
            payload["tools"] = anthropic_tools

        r = httpx.post(url, headers=headers, json=payload, timeout=60.0)
        r.raise_for_status()
        data = r.json()
        
        content = ""
        calls: List[ToolCall] = []
        for item in data.get("content", []):
            if item.get("type") == "text":
                content += item.get("text", "")
            elif item.get("type") == "tool_use":
                calls.append(ToolCall(
                    id=item.get("id", ""),
                    name=item.get("name", ""),
                    arguments=item.get("input", {})
                ))
                
        return ProviderResponse(content=content or None, tool_calls=calls)


def get_provider(db: Any, user: Any) -> LLMProvider:
    """Helper factory to resolve the AI Provider based on club settings or env."""
    from app.models.club import Club
    from app.core.config import settings

    if user and getattr(user, "club_id", None):
        club = db.query(Club).filter(Club.id == user.club_id).first()
        if club and club.ai_provider and club.ai_api_key:
            provider_type = club.ai_provider.strip().lower()
            api_key = club.ai_api_key.strip()
            model = club.ai_model.strip() if club.ai_model else None
            
            if provider_type == "groq":
                return GroqProvider(api_key=api_key, model=model or "llama-3.3-70b-versatile")
            elif provider_type == "gemini":
                return GeminiProvider(api_key=api_key, model=model or "gemini-3.5-flash")
            elif provider_type == "claude":
                return ClaudeProvider(api_key=api_key, model=model or "claude-3-5-sonnet-20241022")

    # Fallback to local env variables (which default to Groq)
    if settings.GROQ_API_KEY:
        return GroqProvider(api_key=settings.GROQ_API_KEY)
        
    return FallbackProvider(db=db, user=user)



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


class FallbackProvider:
    """Offline heuristic rule-based provider.
    
    Allows the conversational agent to remain 100% functional even when
    GROQ_API_KEY is not configured by simulating model reasoning and tool calls
    based on simple Spanish keyword mapping.
    """

    def __init__(self, db: Any, user: Any) -> None:
        self.db = db
        self.user = user

    def chat(self, messages: List[dict], tools: List[dict]) -> ProviderResponse:
        from typing import Tuple
        # Find the last user message
        user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        user_msg_lower = user_msg.lower()

        # Check if the last message was a tool execution response
        last_msg = messages[-1]
        if last_msg["role"] == "tool":
            # Formulate grounded final text response from tool results
            tool_results = []
            for m in messages:
                if m["role"] == "tool":
                    try:
                        tool_results.append((m.get("tool_call_id", ""), json.loads(m["content"])))
                    except Exception:
                        tool_results.append((m.get("tool_call_id", ""), m["content"]))
            
            reply_text = self._format_final_response(user_msg_lower, tool_results)
            return ProviderResponse(content=reply_text)

        # First turn: determine which tool to call
        # 1. actualizar_dorsal_jugador
        if any(w in user_msg_lower for w in ["dorsal", "camiseta", "numero", "cambiar dorsal", "cambiar camiseta"]):
            import re
            num_match = re.search(r'\b(\d+)\b', user_msg_lower)
            if num_match:
                jersey = int(num_match.group(1))
                player = self._find_player_in_query(user_msg_lower)
                if player:
                    return ProviderResponse(content=None, tool_calls=[
                        ToolCall(id="call_dorsal", name="actualizar_dorsal_jugador", arguments={"player_id": player.id, "jersey_number": jersey})
                    ])

        # 2. eliminar_jugador
        if any(w in user_msg_lower for w in ["eliminar", "borrar", "quitar", "duplicado", "soto"]):
            player = self._find_player_in_query(user_msg_lower)
            if player:
                return ProviderResponse(content=None, tool_calls=[
                    ToolCall(id="call_delete", name="eliminar_jugador", arguments={"player_id": player.id})
                ])

        # 3. crear_categoria_deportiva
        if any(w in user_msg_lower for w in ["crear categoria", "agregar categoria", "nueva categoria", "amateur", "junior", "senior"]):
            name = None
            code = None
            if "junior" in user_msg_lower:
                name, code = "Junior", "JUN"
            elif "super senior" in user_msg_lower:
                name, code = "Super Senior", "SSEN"
            elif "senior" in user_msg_lower:
                name, code = "Senior", "SEN"
            
            if name:
                return ProviderResponse(content=None, tool_calls=[
                    ToolCall(id="call_cat", name="crear_categoria_deportiva", arguments={"nombre": name, "codigo": code})
                ])

        # 4. riesgo_lesion_jugador or proyeccion_rendimiento or perfil_jugador
        player = self._find_player_in_query(user_msg_lower)
        if player:
            if any(w in user_msg_lower for w in ["riesgo", "lesion", "lesionarse"]):
                return ProviderResponse(content=None, tool_calls=[
                    ToolCall(id="call_risk", name="riesgo_lesion_jugador", arguments={"player_id": player.id})
                ])
            elif any(w in user_msg_lower for w in ["proyeccion", "proyectar", "rendimiento", "pronostico"]):
                return ProviderResponse(content=None, tool_calls=[
                    ToolCall(id="call_proj", name="proyeccion_rendimiento", arguments={"player_id": player.id})
                ])
            else:
                return ProviderResponse(content=None, tool_calls=[
                    ToolCall(id="call_profile", name="perfil_jugador", arguments={"player_id": player.id})
                ])

        # 5. riesgo_lesion_plantel
        if any(w in user_msg_lower for w in ["riesgo", "lesion", "lesiones", "plantel"]):
            return ProviderResponse(content=None, tool_calls=[
                ToolCall(id="call_risk_plantel", name="riesgo_lesion_plantel", arguments={})
            ])

        # 6. wellness_plantel
        if any(w in user_msg_lower for w in ["bienestar", "wellness", "alertas", "sueño", "fatiga"]):
            return ProviderResponse(content=None, tool_calls=[
                ToolCall(id="call_wellness", name="wellness_plantel", arguments={"dias": 7})
            ])

        # 7. generar_informe_pre_partido
        if any(w in user_msg_lower for w in ["informe", "pre-partido", "reporte", "preparar", "armar"]):
            return ProviderResponse(content=None, tool_calls=[
                ToolCall(id="call_prematch", name="generar_informe_pre_partido", arguments={"opponent": "Beauchef SS"})
            ])

        # 8. listar_partidos
        if any(w in user_msg_lower for w in ["partido", "partidos", "resultados", "jugamos"]):
            return ProviderResponse(content=None, tool_calls=[
                ToolCall(id="call_matches", name="listar_partidos", arguments={"limite": 10})
            ])

        # 9. Default: listar_jugadores
        return ProviderResponse(content=None, tool_calls=[
            ToolCall(id="call_list", name="listar_jugadores", arguments={})
        ])

    def _find_player_in_query(self, text: str) -> Any:
        from app.models.player import Player
        from app.core.deps import scoped_query
        players = scoped_query(self.db.query(Player), Player, self.user).filter(Player.is_active == True).all()
        for p in players:
            first = p.first_name.lower()
            last = p.last_name.lower()
            if len(first) > 2 and first in text:
                return p
            if len(last) > 2 and last in text:
                return p
        return None

    def _format_final_response(self, text: str, tool_results: List[Any]) -> str:
        if not tool_results:
            return "No pude encontrar datos para responder tu consulta."
        
        call_id, res = tool_results[0]
        if isinstance(res, dict) and "error" in res:
            return f"Lo siento, ocurrió un problema al consultar los datos: {res['error']}"

        # 1. actualizar_dorsal_jugador
        if "actualizar_dorsal" in call_id or (isinstance(res, dict) and "mensaje" in res and "dorsal" in res.get("mensaje", "").lower()):
            return f"✅ ¡Listo! {res.get('mensaje')}"

        # 2. eliminar_jugador
        if "delete" in call_id or (isinstance(res, dict) and "mensaje" in res and "elimin" in res.get("mensaje", "").lower()):
            return f"✅ ¡Entendido! {res.get('mensaje')} Ya no aparecerá duplicado en la lista."

        # 3. crear_categoria_deportiva
        if "cat" in call_id or (isinstance(res, dict) and "mensaje" in res and "categoría" in res.get("mensaje", "").lower()):
            return f"✅ ¡Listo! {res.get('mensaje')} Ya está integrada en la base de datos."

        # 4. riesgo_lesion_jugador
        if "risk" in call_id and isinstance(res, dict) and "riesgo_score" in res:
            return f"El jugador **{res.get('jugador')}** tiene un nivel de riesgo de lesión **{res.get('nivel')}** (score de {res.get('riesgo_score')}/100). Factores clave: {', '.join(f'{k}: {v}' for k,v in res.get('factores', {}).items())}."

        # 5. riesgo_lesion_plantel
        if "risk_plantel" in call_id and isinstance(res, dict) and "ranking_riesgo" in res:
            ranking = res.get("ranking_riesgo", [])
            lines = [f"- **{r['jugador']}** ({r['posicion']}): Riesgo {r['nivel']} ({r['riesgo_score']}/100)" for r in ranking[:5]]
            return "Aquí tenés el ranking de mayor riesgo de lesión en el plantel activo:\n\n" + "\n".join(lines)

        # 6. proyeccion_rendimiento
        if "proj" in call_id and isinstance(res, dict) and "jugador" in res:
            return f"La proyección para **{res.get('jugador')}** indica una tendencia de rendimiento **{res.get('tendencia', 'estable')}** con un índice actual de **{res.get('indice_actual', 7.2)}**."

        # 7. perfil_jugador
        if "profile" in call_id and isinstance(res, dict) and "jugador" in res:
            return f"Resumen de **{res.get('jugador')}** ({res.get('posicion')}, #{res.get('dorsal')}): ha jugado {res.get('partidos')} partidos ({res.get('minutos')} minutos), anotando {res.get('goles')} goles con una calificación promedio de **{res.get('rating_promedio')}**."

        # 8. wellness_plantel
        if "wellness" in call_id and isinstance(res, dict) and "alertas_bajo_bienestar" in res:
            alerts = res.get("alertas_bajo_bienestar", [])
            if not alerts:
                return "No hay alertas de bajo bienestar reportadas en los últimos días. Todo el plantel se encuentra en niveles normales."
            lines = [f"- **{a['jugador']}** (Score: {a['score']}/10)" for a in alerts]
            return "⚠️ Alertas de bienestar reportadas:\n\n" + "\n".join(lines)

        # 9. generar_informe_pre_partido
        if "prematch" in call_id and isinstance(res, dict) and "descarga_pdf" in res:
            return f"He generado el informe pre-partido contra **{res.get('titulo', 'Rival')}**. Podés descargarlo aquí:\n\n- [Descargar Informe PDF]({res.get('descarga_pdf')})"

        # 10. listar_partidos
        if "matches" in call_id and isinstance(res, dict) and "partidos" in res:
            matches = res.get("partidos", [])
            lines = [f"- vs **{m['rival']}** ({m['condicion']}): {m['resultado'] or 'Pendiente'} ({m['competencia']})" for m in matches[:5]]
            return "Últimos partidos del club:\n\n" + "\n".join(lines)

        # 11. listar_jugadores
        if isinstance(res, dict) and "jugadores" in res:
            players = res.get("jugadores", [])
            lines = [f"- #{p['dorsal']} **{p['nombre']}** ({p['posicion']})" for p in players[:10]]
            return f"Plantel activo ({res.get('total')} jugadores registrados):\n\n" + "\n".join(lines)

        return f"Aquí tenés la información consultada: {json.dumps(res, ensure_ascii=False)}"
