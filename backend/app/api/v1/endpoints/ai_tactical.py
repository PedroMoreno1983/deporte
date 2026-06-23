from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Optional, List
from datetime import date, timedelta
import json

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.player import Player
from app.models.injury import Injury
from app.models.wellness import WellnessEntry
from app.models.match import Match
from app.agent import run_agent
from app.agent.provider import GroqProvider

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class MatchContext(BaseModel):
    minute: int = 0
    score_home: int = 0
    score_away: int = 0
    opponent: str = "Rival"
    is_home: bool = True


class AIRecommendRequest(BaseModel):
    formation:       str
    players_json:    Any
    assignments_json: Optional[Any] = None
    match_context:   MatchContext


class PlayerChange(BaseModel):
    token_id:         str
    current_abbr:     str
    suggested_abbr:   str
    player_name:      Optional[str] = None
    reason:           str


class AIRecommendResponse(BaseModel):
    analysis:           str
    urgency:            str  # "baja" | "media" | "alta" | "critica"
    suggested_formation: Optional[str] = None
    formation_reason:   Optional[str] = None
    player_changes:     List[PlayerChange] = []
    tactical_tips:      List[str] = []


# ── Helper: build context from DB ─────────────────────────────────────────────

def _build_team_context(db: Session) -> dict:
    today = date.today()

    # Wellness últimos 3 días
    wellness_rows = (
        db.query(WellnessEntry, Player)
        .join(Player)
        .filter(WellnessEntry.entry_date >= today - timedelta(days=3))
        .all()
    )
    wellness_summary = []
    for w, p in wellness_rows:
        wellness_summary.append({
            "player": p.full_name,
            "date": str(w.entry_date),
            "score": round(w.wellness_score or 0, 1),
            "fatigue": w.fatigue,
            "sleep": w.sleep_quality,
            "soreness": w.muscle_soreness,
        })

    # Lesiones activas
    injuries = (
        db.query(Injury, Player)
        .join(Player)
        .filter(Injury.return_date == None)  # noqa
        .all()
    )
    injury_list = [
        {"player": p.full_name, "injury": i.injury_type, "since": str(i.injury_date)}
        for i, p in injuries
    ]

    # Últimos 5 partidos
    recent_matches = (
        db.query(Match)
        .order_by(Match.date.desc())
        .limit(5)
        .all()
    )
    match_list = [
        {
            "date": str(m.date),
            "opponent": m.opponent,
            "score": f"{m.goals_for}-{m.goals_against}",
            "result": "V" if m.goals_for > m.goals_against else ("E" if m.goals_for == m.goals_against else "D"),
        }
        for m in recent_matches
    ]

    return {
        "wellness": wellness_summary,
        "injuries": injury_list,
        "recent_matches": match_list,
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

# ── Chat (conversational) ─────────────────────────────────────────────

class ChatMessage(BaseModel):
    role:    str  # "user" | "assistant" | "system"
    content: str


class TacticalChatRequest(BaseModel):
    messages: List[ChatMessage]
    include_team_context: bool = True


class TacticalChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=TacticalChatResponse)
def tactical_chat(
    body: TacticalChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Free-form conversation with the tactical assistant. Runs the tool-calling agent loop."""
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY no configurada")
    try:
        provider = GroqProvider(api_key=settings.GROQ_API_KEY)
    except ImportError:
        raise HTTPException(status_code=503, detail="Paquete 'groq' no instalado")
    if not body.messages:
        raise HTTPException(status_code=400, detail="Enviar al menos un mensaje")

    messages_list = [{"role": m.role, "content": m.content} for m in body.messages]
    result = run_agent(
        messages_list,
        db=db,
        current_user=current_user,
        provider=provider,
    )
    return TacticalChatResponse(reply=result.reply)


@router.post("/recommend", response_model=AIRecommendResponse)
def get_recommendation(
    body: AIRecommendRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY no configurada")

    try:
        from groq import Groq
    except ImportError:
        raise HTTPException(status_code=503, detail="groq package no instalado")

    team_ctx = _build_team_context(db)
    ctx = body.match_context

    # Build assigned players list
    assigned = []
    if body.assignments_json:
        for token_id, asgn in body.assignments_json.items():
            assigned.append(f"{asgn.get('name','?')} (#{asgn.get('num','?')})")

    system_prompt = """Eres un analista táctico experto en fútbol latinoamericano.
Debes responder SIEMPRE en español con JSON válido y sin texto adicional.
El JSON debe tener exactamente estos campos:
{
  "analysis": "análisis de situación en 2-3 oraciones",
  "urgency": "baja|media|alta|critica",
  "suggested_formation": "4-3-3 o null si no recomiendas cambio",
  "formation_reason": "razón del cambio o null",
  "player_changes": [
    {"token_id": "id del token", "current_abbr": "posición actual", "suggested_abbr": "posición sugerida", "player_name": "nombre o null", "reason": "razón breve"}
  ],
  "tactical_tips": ["tip 1", "tip 2", "tip 3"]
}
Máximo 3 player_changes y 4 tactical_tips. Sé concreto y práctico."""

    user_prompt = f"""CONTEXTO DEL PARTIDO:
- Minuto: {ctx.minute}
- Marcador: {"Nosotros" if ctx.is_home else ctx.opponent} {ctx.score_home} - {ctx.score_away} {"Nosotros" if not ctx.is_home else ctx.opponent}
- Rival: {ctx.opponent}
- Condición: {"Local" if ctx.is_home else "Visitante"}

FORMACIÓN ACTUAL: {body.formation}
JUGADORES EN CANCHA: {", ".join(assigned) if assigned else "Sin asignar"}

WELLNESS DEL PLANTEL (últimos 3 días):
{json.dumps(team_ctx["wellness"], ensure_ascii=False, indent=2) if team_ctx["wellness"] else "Sin datos"}

LESIONES ACTIVAS:
{json.dumps(team_ctx["injuries"], ensure_ascii=False) if team_ctx["injuries"] else "Ninguna"}

ÚLTIMOS 5 PARTIDOS:
{json.dumps(team_ctx["recent_matches"], ensure_ascii=False, indent=2) if team_ctx["recent_matches"] else "Sin datos"}

Analiza la situación y recomienda ajustes tácticos. Si el equipo va perdiendo en los últimos minutos, sé más agresivo. Si va ganando, sugiere mayor solidez defensiva."""

    client = Groq(api_key=settings.GROQ_API_KEY)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.65,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content
    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="Respuesta de IA inválida")

    return AIRecommendResponse(
        analysis=data.get("analysis", "Sin análisis disponible."),
        urgency=data.get("urgency", "media"),
        suggested_formation=data.get("suggested_formation"),
        formation_reason=data.get("formation_reason"),
        player_changes=[PlayerChange(**c) for c in data.get("player_changes", [])],
        tactical_tips=data.get("tactical_tips", []),
    )
