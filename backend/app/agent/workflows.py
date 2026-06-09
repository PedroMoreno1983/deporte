"""Agent action workflows (level 3): multi-step tasks that produce a deliverable.

The first workflow is the **pre-match report**: gather our squad readiness
(availability, injury risk, recent form, wellness), write a grounded prep plan
(LLM with templated fallback), persist it as an ``AgentReport`` and render a PDF
on demand. We do NOT have the opponent's scouting data unless it was imported,
so the plan is honestly framed around *our* preparation — never invents rival
stats.
"""
from __future__ import annotations

import io
import json
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..models.match import Match
from ..models.agent_report import AgentReport
from .briefing import gather_signals

log = logging.getLogger("agent.workflows")

BRAND_GREEN = "#00c96a"


# ── build ─────────────────────────────────────────────────────────────────────

def _resolve_target(db: Session, club_id: int, opponent: Optional[str], match_id: Optional[int]):
    """Return (opponent_name, match_date, match_obj) for the report target."""
    if match_id is not None:
        m = db.query(Match).filter(Match.club_id == club_id, Match.id == match_id).first()
        if m:
            return m.opponent, (m.date.isoformat() if m.date else None), m
    if opponent:
        m = (
            db.query(Match)
            .filter(Match.club_id == club_id, Match.date >= date.today(),
                    Match.opponent.ilike(f"%{opponent}%"))
            .order_by(Match.date.asc()).first()
        )
        return opponent, (m.date.isoformat() if m and m.date else None), m
    # default: the next upcoming match
    m = (
        db.query(Match).filter(Match.club_id == club_id, Match.date >= date.today())
        .order_by(Match.date.asc()).first()
    )
    if m:
        return m.opponent, (m.date.isoformat() if m.date else None), m
    return None, None, None


def _template_plan(opponent: Optional[str], signals: Dict[str, Any]) -> Dict[str, Any]:
    crit = [r for r in signals["riesgo_top"] if r["nivel"] in ("high", "critical")]
    plan = [
        "Confirmar disponibilidad: revisar lesionados activos y jugadores en riesgo antes de citar.",
        "Gestión de carga en la semana para los de riesgo elevado; descarga si hace falta.",
        "Definir XI y plan de relevos según minutos y bienestar reciente.",
    ]
    vigilar = [f"{r['jugador']} (riesgo {r['nivel']}, {r['score']})" for r in (crit or signals["riesgo_top"][:3])]
    resumen = (
        f"Preparación para el partido vs {opponent or 'rival'}. "
        f"{len(signals['lesiones_activas'])} lesionado(s) activo(s), "
        f"{len(crit)} en riesgo elevado, {len(signals['wellness_bajo'])} con bienestar bajo."
    )
    return {"resumen": resumen, "plan_tactico": plan, "jugadores_a_vigilar": vigilar,
            "recomendaciones": ["Importar eventos del rival (Wyscout) para sumar scouting al informe."]}


def _llm_plan(opponent: Optional[str], signals: Dict[str, Any], provider) -> Optional[Dict[str, Any]]:
    sys = (
        "Sos el analista del cuerpo técnico. Armás un INFORME PRE-PARTIDO accionable en español. "
        "REGLA DURA: usá EXCLUSIVAMENTE los datos del JSON (son de NUESTRO plantel). NO tenés datos "
        "del rival más allá de su nombre, así que el plan se enfoca en NUESTRA preparación "
        "(disponibilidad, riesgo, carga, bienestar, forma). No inventes estadísticas del rival ni "
        "nombres. Devolvé JSON válido: {\"resumen\": \"2-4 frases\", \"plan_tactico\": [\"...\"], "
        "\"jugadores_a_vigilar\": [\"...\"], \"recomendaciones\": [\"...\"]}."
    )
    user = f"RIVAL: {opponent or 'desconocido'}\nNUESTRO PLANTEL (señales):\n" + json.dumps(signals, ensure_ascii=False)
    try:
        resp = provider.chat([{"role": "system", "content": sys}, {"role": "user", "content": user}], tools=[])
        data = json.loads(resp.content or "{}")
        if not data.get("resumen"):
            return None
        return {
            "resumen": str(data["resumen"]),
            "plan_tactico": [str(x) for x in (data.get("plan_tactico") or [])][:8],
            "jugadores_a_vigilar": [str(x) for x in (data.get("jugadores_a_vigilar") or [])][:8],
            "recomendaciones": [str(x) for x in (data.get("recomendaciones") or [])][:6],
        }
    except Exception as exc:  # noqa: BLE001 — fall back to template
        log.warning("LLM pre-match plan failed, using template: %s", exc)
        return None


def build_prematch_report(
    db: Session, club_id: int, *, opponent: Optional[str] = None,
    match_id: Optional[int] = None, provider=None,
) -> Dict[str, Any]:
    opp, match_date, _match = _resolve_target(db, club_id, opponent, match_id)
    signals = gather_signals(db, club_id)
    generated_by = "template"
    plan = None
    if provider is not None:
        plan = _llm_plan(opp, signals, provider)
        if plan:
            generated_by = "llm"
    if plan is None:
        plan = _template_plan(opp, signals)

    disponibles = max(0, signals["plantel_activo"] - len(signals["lesiones_activas"]))
    return {
        "kind": "prematch",
        "generated_at": datetime.utcnow().isoformat(timespec="seconds"),
        "generated_by": generated_by,
        "opponent": opp,
        "match_date": match_date,
        "disponibles_estimados": disponibles,
        "signals": signals,
        "plan": plan,
    }


def run_prematch_workflow(
    db: Session, club_id: int, *, opponent: Optional[str] = None, match_id: Optional[int] = None,
    provider=None, created_by: Optional[int] = None,
) -> AgentReport:
    data = build_prematch_report(db, club_id, opponent=opponent, match_id=match_id, provider=provider)
    title = f"Informe pre-partido vs {data['opponent'] or 'rival'}"
    row = AgentReport(club_id=club_id, kind="prematch", title=title,
                      subject=data["opponent"], data=data, created_by=created_by)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_report(db: Session, club_id: int, report_id: int) -> Optional[AgentReport]:
    return (
        db.query(AgentReport)
        .filter(AgentReport.club_id == club_id, AgentReport.id == report_id).first()
    )


def latest_reports(db: Session, club_id: int, limit: int = 10) -> List[AgentReport]:
    return (
        db.query(AgentReport).filter(AgentReport.club_id == club_id)
        .order_by(AgentReport.id.desc()).limit(limit).all()
    )


# ── PDF render (reportlab, lazy) ──────────────────────────────────────────────

def render_prematch_pdf(data: Dict[str, Any], club_name: str = "Deporte FC") -> bytes:
    """Render the stored pre-match report to a PDF (reportlab)."""
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable,
    )

    green = colors.HexColor(BRAND_GREEN)
    dark = colors.HexColor("#0b1220")
    grey = colors.HexColor("#6b7280")
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=18, textColor=dark, spaceAfter=2, alignment=TA_LEFT)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10, textColor=grey)
    sec = ParagraphStyle("sec", parent=styles["Heading2"], fontSize=12, textColor=green, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9.5, leading=14, textColor=dark)
    li = ParagraphStyle("li", parent=body, leftIndent=8, bulletIndent=0)

    s = data.get("signals", {})
    plan = data.get("plan", {})
    elems: List[Any] = []

    elems.append(Paragraph(f"Informe Pre-Partido", h1))
    elems.append(Paragraph(
        f"{club_name} vs <b>{data.get('opponent') or 'rival'}</b>"
        + (f" · {data['match_date']}" if data.get("match_date") else "")
        + f" · generado {data.get('generated_at','')[:10]}", sub))
    elems.append(Spacer(1, 4))
    elems.append(HRFlowable(width="100%", thickness=1.2, color=green))
    elems.append(Spacer(1, 6))

    # Resumen
    if plan.get("resumen"):
        elems.append(Paragraph("Resumen", sec))
        elems.append(Paragraph(plan["resumen"], body))

    # Disponibilidad / contexto
    elems.append(Paragraph("Disponibilidad del plantel", sec))
    ctx = [
        ["Plantel activo", str(s.get("plantel_activo", 0))],
        ["Disponibles (estimado)", str(data.get("disponibles_estimados", 0))],
        ["Lesionados activos", str(len(s.get("lesiones_activas", [])))],
        ["Riesgo elevado", str(len([r for r in s.get("riesgo_top", []) if r.get("nivel") in ("high", "critical")]))],
        ["Bienestar bajo", str(len(s.get("wellness_bajo", [])))],
    ]
    t = Table(ctx, colWidths=[70 * mm, 30 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), grey),
        ("TEXTCOLOR", (1, 0), (1, -1), dark),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#e5e7eb")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elems.append(t)

    # Forma reciente
    form = s.get("forma_reciente", [])
    if form:
        elems.append(Paragraph("Forma reciente", sec))
        rows = [["Fecha", "Rival", "Resultado", ""]] + [
            [f.get("fecha", ""), f.get("rival", ""), f.get("resultado") or "—", f.get("signo") or ""] for f in form
        ]
        ft = Table(rows, colWidths=[28 * mm, 70 * mm, 25 * mm, 12 * mm])
        ft.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), grey), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        elems.append(ft)

    # A vigilar
    if plan.get("jugadores_a_vigilar"):
        elems.append(Paragraph("Jugadores a vigilar", sec))
        for x in plan["jugadores_a_vigilar"]:
            elems.append(Paragraph(f"• {x}", li))

    # Plan táctico
    if plan.get("plan_tactico"):
        elems.append(Paragraph("Plan de preparación", sec))
        for x in plan["plan_tactico"]:
            elems.append(Paragraph(f"• {x}", li))

    # Recomendaciones
    if plan.get("recomendaciones"):
        elems.append(Paragraph("Recomendaciones", sec))
        for x in plan["recomendaciones"]:
            elems.append(Paragraph(f"• {x}", li))

    elems.append(Spacer(1, 10))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb")))
    elems.append(Paragraph(
        "Generado por el agente de Deporte FC sobre datos del club. "
        + ("Narrativa por IA." if data.get("generated_by") == "llm" else "Narrativa automática."), sub))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm, title="Informe Pre-Partido")
    doc.build(elems)
    return buf.getvalue()
