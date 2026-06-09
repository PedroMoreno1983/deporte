"""Agent chat endpoint — the GaaS surface.

``POST /agent/chat`` runs the tool-using agent over the conversation, grounding
every answer in the caller's club data. Returns the reply plus the trace of
tools/data used (transparency), so the UI can show what backed each answer.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....core.deps import get_current_user
from ....core.config import settings
from ....models.club import Club
from ....agent import run_agent
from ....agent.provider import GroqProvider
from ....agent.briefing import generate_club_briefing, persist_briefing, latest_briefing
from ....agent.workflows import (
    run_prematch_workflow, get_report, latest_reports, render_prematch_pdf, render_prematch_docx,
)

router = APIRouter()


def _provider_or_none():
    if not settings.GROQ_API_KEY:
        return None
    try:
        return GroqProvider(api_key=settings.GROQ_API_KEY)
    except ImportError:
        return None


def _club_id_or_400(current_user) -> int:
    club_id = getattr(current_user, "club_id", None)
    if not club_id:
        raise HTTPException(status_code=400, detail="Tu usuario no tiene un club asignado.")
    return club_id


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


# ── Proactive: the daily squad briefing (level 2) ─────────────────────────────

class BriefingOut(BaseModel):
    id: Optional[int] = None
    briefing_date: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    data: Any = None
    generated_by: Optional[str] = None


def _briefing_out(row) -> BriefingOut:
    return BriefingOut(
        id=row.id,
        briefing_date=row.briefing_date.isoformat() if row.briefing_date else None,
        headline=row.headline, summary=row.summary, data=row.data,
        generated_by=row.generated_by,
    )


@router.get("/briefing", response_model=Optional[BriefingOut])
def get_latest_briefing(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Último briefing proactivo del club (lo genera el agente programado)."""
    row = latest_briefing(db, _club_id_or_400(current_user))
    return _briefing_out(row) if row else None


@router.post("/briefing/run", response_model=BriefingOut)
def run_briefing_now(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Genera (y persiste) el briefing de hoy para tu club, en el momento."""
    club_id = _club_id_or_400(current_user)
    result = generate_club_briefing(db, club_id, provider=_provider_or_none())
    return _briefing_out(persist_briefing(db, club_id, result))


# ── Workflows que actúan: informe pre-partido (level 3) ───────────────────────

class PrematchRequest(BaseModel):
    opponent: Optional[str] = None
    match_id: Optional[int] = None


class ReportOut(BaseModel):
    id: int
    kind: str
    title: Optional[str] = None
    subject: Optional[str] = None
    created_at: Optional[str] = None
    download_pdf: str
    download_docx: str


def _report_out(row) -> ReportOut:
    return ReportOut(
        id=row.id, kind=row.kind, title=row.title, subject=row.subject,
        created_at=row.created_at.isoformat() if row.created_at else None,
        download_pdf=f"/api/v1/agent/report/{row.id}.pdf",
        download_docx=f"/api/v1/agent/report/{row.id}.docx",
    )


@router.post("/report/prematch", response_model=ReportOut)
def create_prematch_report(
    body: PrematchRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    """Workflow: arma + persiste un informe pre-partido para tu club."""
    club_id = _club_id_or_400(current_user)
    row = run_prematch_workflow(
        db, club_id, opponent=body.opponent, match_id=body.match_id,
        provider=_provider_or_none(), created_by=getattr(current_user, "id", None),
    )
    return _report_out(row)


@router.get("/reports", response_model=List[ReportOut])
def list_reports(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    club_id = _club_id_or_400(current_user)
    return [_report_out(r) for r in latest_reports(db, club_id)]


@router.get("/report/{report_id}.pdf")
def download_report_pdf(
    report_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    club_id = _club_id_or_400(current_user)
    row = get_report(db, club_id, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Informe no encontrado")
    club = db.query(Club).filter(Club.id == club_id).first()
    try:
        pdf = render_prematch_pdf(row.data or {}, club_name=club.name if club else "Deporte FC")
    except ImportError:
        raise HTTPException(status_code=503, detail="Generación de PDF no disponible (reportlab).")
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="informe_{report_id}.pdf"'},
    )


@router.get("/report/{report_id}.docx")
def download_report_docx(
    report_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    club_id = _club_id_or_400(current_user)
    row = get_report(db, club_id, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Informe no encontrado")
    club = db.query(Club).filter(Club.id == club_id).first()
    try:
        docx_bytes = render_prematch_docx(row.data or {}, club_name=club.name if club else "Deporte FC")
    except ImportError:
        raise HTTPException(status_code=503, detail="Generación de Word no disponible (python-docx).")
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="informe_{report_id}.docx"'},
    )
