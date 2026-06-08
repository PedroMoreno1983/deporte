"""Agent chat endpoint — the GaaS surface.

``POST /agent/chat`` runs the tool-using agent over the conversation, grounding
every answer in the caller's club data. Returns the reply plus the trace of
tools/data used (transparency), so the UI can show what backed each answer.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....core.deps import get_current_user
from ....core.config import settings
from ....agent import run_agent
from ....agent.provider import GroqProvider

router = APIRouter()


class AgentMessage(BaseModel):
    role: str       # "user" | "assistant"
    content: str


class AgentChatRequest(BaseModel):
    messages: List[AgentMessage]


class AgentToolCall(BaseModel):
    tool: str
    args: Dict[str, Any]
    result: Any


class AgentChatResponse(BaseModel):
    reply: str
    tool_calls: List[AgentToolCall]
    iterations: int


@router.post("/chat", response_model=AgentChatResponse)
def agent_chat(
    body: AgentChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Converse with the data agent. Grounded in your club's data via tools."""
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY no configurada")
    if not body.messages:
        raise HTTPException(status_code=400, detail="Enviá al menos un mensaje")
    try:
        provider = GroqProvider(api_key=settings.GROQ_API_KEY)
    except ImportError:
        raise HTTPException(status_code=503, detail="Paquete 'groq' no instalado")

    result = run_agent(
        [m.model_dump() for m in body.messages],
        db=db, current_user=current_user, provider=provider,
    )
    return AgentChatResponse(
        reply=result.reply,
        tool_calls=[AgentToolCall(**tc) for tc in result.tool_calls],
        iterations=result.iterations,
    )
