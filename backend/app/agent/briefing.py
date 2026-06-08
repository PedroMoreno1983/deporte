"""Proactive agent: the daily squad briefing.

Runs on a schedule (no user prompt). For a club it gathers the signals that
matter — live injury-risk ranking, wellness alerts, active injuries, recent
form, next match — then writes a short coach-ready briefing (LLM when a key is
configured, otherwise a deterministic template) and persists one row per
``(club, day)``. Everything is scoped to the club; the narrative is grounded
strictly in the gathered signals (no invention).
"""
from __future__ import annotations

import json
import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..models.player import Player, PlayerStatus
from ..models.injury import Injury
from ..models.wellness import WellnessEntry
from ..models.match import Match
from ..models.club import Club
from ..models.agent_briefing import AgentBriefing
from ..ml.injury_risk import calculate_injury_risk

log = logging.getLogger("agent.briefing")

_RISK_ORDER = {"critical": 3, "high": 2, "medium": 1, "low": 0}


def gather_signals(db: Session, club_id: int) -> Dict[str, Any]:
    """Collect the club's key squad signals for today (all club-scoped)."""
    players = (
        db.query(Player)
        .filter(Player.club_id == club_id, Player.is_active == True)  # noqa: E712
        .all()
    )
    pid_to_name = {p.id: p.full_name for p in players}

    # Live injury risk (top of the ranking)
    risks: List[Dict[str, Any]] = []
    for p in players[:40]:
        if p.status == PlayerStatus.INJURED:
            continue
        r = calculate_injury_risk(p.id, db)
        risks.append({"player_id": p.id, "jugador": p.full_name,
                      "score": r.get("score"), "nivel": r.get("level")})
    risks.sort(key=lambda x: (_RISK_ORDER.get(x["nivel"], 0), x["score"] or 0), reverse=True)
    top_risks = [r for r in risks if _RISK_ORDER.get(r["nivel"], 0) >= 2][:6] or risks[:3]

    # Active injuries
    active_injuries = []
    for inj in db.query(Injury).filter(
        Injury.is_recovered == False, Injury.player_id.in_(list(pid_to_name))  # noqa: E712
    ).all():
        active_injuries.append({
            "jugador": pid_to_name.get(inj.player_id, f"#{inj.player_id}"),
            "tipo": inj.injury_type,
            "desde": str(inj.injury_date) if inj.injury_date else None,
        })

    # Low wellness (most recent entry per player, last 3 days)
    since = date.today() - timedelta(days=3)
    rows = (
        db.query(WellnessEntry)
        .filter(WellnessEntry.entry_date >= since, WellnessEntry.player_id.in_(list(pid_to_name)))
        .order_by(WellnessEntry.entry_date.desc()).all()
    )
    seen: set = set()
    low_wellness = []
    for w in rows:
        if w.player_id in seen:
            continue
        seen.add(w.player_id)
        score = round(w.wellness_score or 0, 1)
        if score and score <= 5:
            low_wellness.append({"jugador": pid_to_name.get(w.player_id, f"#{w.player_id}"),
                                 "score": score, "fecha": str(w.entry_date)})

    # Recent form (last 5 finished matches)
    recent = db.query(Match).filter(Match.club_id == club_id).order_by(Match.date.desc()).limit(5).all()
    form = []
    for m in recent:
        gf, ga = m.goals_for, m.goals_against
        signo = None
        if gf is not None and ga is not None:
            signo = "V" if gf > ga else ("E" if gf == ga else "D")
        form.append({"fecha": str(m.date), "rival": m.opponent,
                     "resultado": (f"{gf}-{ga}" if gf is not None and ga is not None else None), "signo": signo})

    # Next match (first upcoming), else None
    upcoming = (
        db.query(Match).filter(Match.club_id == club_id, Match.date >= date.today())
        .order_by(Match.date.asc()).first()
    )
    next_match = None
    if upcoming:
        next_match = {"fecha": str(upcoming.date), "rival": upcoming.opponent,
                      "condicion": "local" if upcoming.is_home else "visitante",
                      "competencia": upcoming.competition}

    return {
        "plantel_activo": len(players),
        "riesgo_top": top_risks,
        "lesiones_activas": active_injuries,
        "wellness_bajo": low_wellness,
        "forma_reciente": form,
        "proximo_partido": next_match,
    }


def _template_narrative(signals: Dict[str, Any]) -> tuple[str, str, List[str]]:
    prios: List[str] = []
    crit = [r for r in signals["riesgo_top"] if r["nivel"] in ("high", "critical")]
    if crit:
        prios.append("Riesgo de lesión elevado: " + ", ".join(
            f"{r['jugador']} ({r['nivel']}, {r['score']})" for r in crit[:4]))
    if signals["wellness_bajo"]:
        prios.append("Bienestar bajo: " + ", ".join(
            f"{w['jugador']} ({w['score']})" for w in signals["wellness_bajo"][:4]))
    if signals["lesiones_activas"]:
        prios.append(f"{len(signals['lesiones_activas'])} lesionados activos: " + ", ".join(
            i["jugador"] for i in signals["lesiones_activas"][:4]))
    if signals["proximo_partido"]:
        nm = signals["proximo_partido"]
        prios.append(f"Próximo partido: {nm['fecha']} vs {nm['rival']} ({nm['condicion']}).")
    headline = (
        f"{len(crit)} jugador(es) en riesgo alto" if crit
        else ("Plantel sin riesgos altos hoy" if not signals["wellness_bajo"] else "Revisar bienestar del plantel")
    )
    summary = "Briefing del plantel.\n- " + "\n- ".join(prios) if prios else \
        "Sin alertas relevantes hoy: riesgo, bienestar y disponibilidad en orden."
    return headline, summary, prios


def _llm_narrative(signals: Dict[str, Any], provider) -> Optional[tuple[str, str, List[str]]]:
    sys = (
        "Sos el analista de datos del cuerpo técnico. Escribís un BRIEFING diario breve y "
        "accionable en español. REGLA DURA: usá EXCLUSIVAMENTE los datos del JSON que te paso; "
        "no inventes jugadores, números ni partidos. Devolvé JSON válido con: "
        '{"headline": "una frase", "prioridades": ["...", "..."], "resumen": "2-4 frases"}'
    )
    user = "SEÑALES DEL PLANTEL (hoy):\n" + json.dumps(signals, ensure_ascii=False)
    try:
        resp = provider.chat(
            [{"role": "system", "content": sys}, {"role": "user", "content": user}], tools=[],
        )
        data = json.loads(resp.content or "{}")
        headline = str(data.get("headline") or "Briefing del plantel")
        prios = [str(x) for x in (data.get("prioridades") or [])][:6]
        summary = str(data.get("resumen") or "")
        if not summary:
            return None
        return headline, summary, prios
    except Exception as exc:  # noqa: BLE001 — fall back to the template
        log.warning("LLM narrative failed, using template: %s", exc)
        return None


def generate_club_briefing(db: Session, club_id: int, provider=None) -> Dict[str, Any]:
    signals = gather_signals(db, club_id)
    generated_by = "template"
    narrative = None
    if provider is not None:
        narrative = _llm_narrative(signals, provider)
        if narrative:
            generated_by = "llm"
    if narrative is None:
        narrative = _template_narrative(signals)
    headline, summary, prios = narrative
    return {
        "briefing_date": date.today(),
        "headline": headline,
        "summary": summary,
        "data": {"signals": signals, "prioridades": prios},
        "generated_by": generated_by,
    }


def persist_briefing(db: Session, club_id: int, result: Dict[str, Any]) -> AgentBriefing:
    row = (
        db.query(AgentBriefing)
        .filter(AgentBriefing.club_id == club_id, AgentBriefing.briefing_date == result["briefing_date"])
        .first()
    )
    if row is None:
        row = AgentBriefing(club_id=club_id, briefing_date=result["briefing_date"])
        db.add(row)
    row.headline = result["headline"]
    row.summary = result["summary"]
    row.data = result["data"]
    row.generated_by = result["generated_by"]
    db.commit()
    db.refresh(row)
    return row


def latest_briefing(db: Session, club_id: int) -> Optional[AgentBriefing]:
    return (
        db.query(AgentBriefing).filter(AgentBriefing.club_id == club_id)
        .order_by(AgentBriefing.briefing_date.desc(), AgentBriefing.id.desc()).first()
    )


def email_sections(signals: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Turn the gathered signals into alert-email sections (color-coded)."""
    sections: List[Dict[str, Any]] = []
    risks = [r for r in signals.get("riesgo_top", []) if r.get("nivel") in ("high", "critical")]
    if risks:
        sections.append({"title": f"Riesgo de lesión elevado ({len(risks)})", "color": "#f97316",
                         "items": [{"label": r["jugador"], "value": f"{r['score']} · {r['nivel']}",
                                    "color": "#ff3b30" if r["nivel"] == "critical" else "#f97316"} for r in risks]})
    low = signals.get("wellness_bajo", [])
    if low:
        sections.append({"title": f"Bienestar bajo ({len(low)})", "color": "#f59e0b",
                         "items": [{"label": w["jugador"], "value": f"{w['score']}/10 · {w['fecha']}",
                                    "color": "#f59e0b"} for w in low]})
    inj = signals.get("lesiones_activas", [])
    if inj:
        sections.append({"title": f"Lesiones activas ({len(inj)})", "color": "#ff3b30",
                         "items": [{"label": i["jugador"], "value": i["tipo"] or "—", "color": "#ff3b30"} for i in inj]})
    return sections


def _club_recipients(db: Session, club_id: int) -> List[str]:
    from ..models.user import User, UserRole
    rows = (
        db.query(User)
        .filter(User.club_id == club_id, User.is_active == True,  # noqa: E712
                User.role.in_([UserRole.ADMIN, UserRole.COACH]))
        .all()
    )
    return [u.email for u in rows if u.email]


def run_for_all_clubs(db: Session, provider=None, notify: bool = False) -> List[Dict[str, Any]]:
    """Generate + persist today's briefing for every club (and optionally email
    it to each club's admins/coaches). For the daily scheduler."""
    out = []
    for club in db.query(Club).all():
        try:
            result = generate_club_briefing(db, club.id, provider=provider)
            row = persist_briefing(db, club.id, result)
            entry = {"club_id": club.id, "briefing_id": row.id, "headline": row.headline}
            if notify:
                sections = email_sections(result["data"]["signals"])
                recipients = _club_recipients(db, club.id)
                if sections and recipients:
                    from ..core.email import send_bulk_alert
                    subject = f"Briefing del plantel — {row.headline}"
                    entry["emailed"] = send_bulk_alert(recipients, subject, sections)
                else:
                    entry["emailed"] = 0
            out.append(entry)
        except Exception as exc:  # noqa: BLE001 — one club must not break the rest
            log.exception("briefing failed for club %s: %s", club.id, exc)
            out.append({"club_id": club.id, "error": str(exc)})
    return out
