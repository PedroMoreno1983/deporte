"""Agent tools — each one runs a **club-scoped** query against real data.

A tool is a pure function ``run(db, current_user, args) -> JSON-able``. Every
query is scoped to ``current_user``'s club (reusing ``scoped_query``), so the
agent physically cannot read another club's data, and it only ever returns
facts that exist in the database — the anti-hallucination guarantee.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Callable, Dict, List

from sqlalchemy.orm import Session

from ..core.deps import scoped_query
from ..models.player import Player, PlayerStatus
from ..models.injury import Injury
from ..models.match import Match, MatchStat
from ..models.match_event import MatchEvent
from ..models.wellness import WellnessEntry
from ..ml.injury_risk import calculate_injury_risk
from ..ml.performance import calculate_performance_projection
from ..analytics import compute_match_analytics


@dataclass
class Tool:
    name: str
    description: str
    parameters: Dict[str, Any]   # JSON schema (object)
    run: Callable[[Session, Any, Dict[str, Any]], Any]


# ── scoping helpers ───────────────────────────────────────────────────────────

def _player_in_club(db: Session, user: Any, player_id: int) -> Player | None:
    return scoped_query(db.query(Player), Player, user).filter(Player.id == player_id).first()


def _match_in_club(db: Session, user: Any, match_id: int) -> Match | None:
    return scoped_query(db.query(Match), Match, user).filter(Match.id == match_id).first()


def _club_player_ids(db: Session, user: Any) -> List[int]:
    return [pid for (pid,) in scoped_query(db.query(Player.id), Player, user).all()]


def _enum(v: Any) -> Any:
    return v.value if hasattr(v, "value") else v


# ── tool implementations ──────────────────────────────────────────────────────

def _listar_jugadores(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    q = scoped_query(db.query(Player), Player, user).filter(Player.is_active == True)  # noqa: E712
    pos = (args.get("posicion") or "").strip().upper()
    status = (args.get("estado") or "").strip().lower()
    search = (args.get("buscar") or "").strip().lower()
    rows = q.order_by(Player.last_name).all()
    out = []
    for p in rows:
        if pos and _enum(p.position) != pos:
            continue
        if status and str(_enum(p.status)).lower() != status:
            continue
        if search and search not in p.full_name.lower():
            continue
        out.append({
            "id": p.id, "nombre": p.full_name, "posicion": _enum(p.position),
            "dorsal": p.jersey_number, "estado": _enum(p.status),
        })
    return {"total": len(out), "jugadores": out[:60]}


def _perfil_jugador(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    p = _player_in_club(db, user, int(args["player_id"]))
    if not p:
        return {"error": "Jugador no encontrado en tu club."}
    stats = db.query(MatchStat).filter(MatchStat.player_id == p.id).all()
    n = len(stats)
    rated = [s.rating for s in stats if s.rating is not None]
    dists = [s.total_distance_m for s in stats if s.total_distance_m]
    active_inj = db.query(Injury).filter(Injury.player_id == p.id, Injury.is_recovered == False).count()  # noqa: E712
    total_inj = db.query(Injury).filter(Injury.player_id == p.id).count()
    return {
        "jugador": p.full_name, "posicion": _enum(p.position), "dorsal": p.jersey_number,
        "estado": _enum(p.status), "partidos": n,
        "minutos": sum(s.minutes_played or 0 for s in stats),
        "goles": sum(s.goals or 0 for s in stats),
        "asistencias": sum(s.assists or 0 for s in stats),
        "rating_promedio": round(sum(rated) / len(rated), 2) if rated else None,
        "distancia_promedio_m": round(sum(dists) / len(dists), 0) if dists else None,
        "lesiones_totales": total_inj, "lesiones_activas": active_inj,
    }


def _riesgo_lesion_jugador(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    p = _player_in_club(db, user, int(args["player_id"]))
    if not p:
        return {"error": "Jugador no encontrado en tu club."}
    r = calculate_injury_risk(p.id, db)
    factors = r.get("factors") or {}
    # Keep the payload compact for the LLM.
    if isinstance(factors, dict):
        factors = {k: factors[k] for k in list(factors)[:5]}
    return {"jugador": p.full_name, "riesgo_score": r.get("score"),
            "nivel": r.get("level"), "factores": factors}


def _riesgo_lesion_plantel(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    players = (
        scoped_query(db.query(Player), Player, user)
        .filter(Player.is_active == True, Player.status != PlayerStatus.INJURED)  # noqa: E712
        .all()
    )
    ranked = []
    for p in players[:40]:  # bound the work
        r = calculate_injury_risk(p.id, db)
        ranked.append({"jugador": p.full_name, "posicion": _enum(p.position),
                       "riesgo_score": r.get("score"), "nivel": r.get("level")})
    ranked.sort(key=lambda x: x["riesgo_score"] or 0, reverse=True)
    return {"evaluados": len(ranked), "ranking_riesgo": ranked[:15]}


def _proyeccion_rendimiento(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    p = _player_in_club(db, user, int(args["player_id"]))
    if not p:
        return {"error": "Jugador no encontrado en tu club."}
    proj = calculate_performance_projection(p.id, db)
    return {"jugador": p.full_name, **(proj if isinstance(proj, dict) else {"proyeccion": proj})}


def _listar_partidos(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    limit = max(1, min(int(args.get("limite", 10)), 30))
    rows = (
        scoped_query(db.query(Match), Match, user)
        .order_by(Match.date.desc()).limit(limit).all()
    )
    out = []
    for m in rows:
        gf, ga = m.goals_for, m.goals_against
        res = None
        if gf is not None and ga is not None:
            res = "V" if gf > ga else ("E" if gf == ga else "D")
        out.append({
            "id": m.id, "fecha": m.date.isoformat() if m.date else None,
            "rival": m.opponent, "condicion": "local" if m.is_home else "visitante",
            "resultado": (f"{gf}-{ga}" if gf is not None and ga is not None else None),
            "signo": res, "competencia": m.competition,
        })
    return {"total": len(out), "partidos": out}


def _analitica_partido(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    m = _match_in_club(db, user, int(args["match_id"]))
    if not m:
        return {"error": "Partido no encontrado en tu club."}
    events = (
        scoped_query(db.query(MatchEvent), MatchEvent, user)
        .filter(MatchEvent.match_id == m.id).order_by(MatchEvent.id.asc()).all()
    )
    if not events:
        return {"partido": m.opponent, "fecha": m.date.isoformat() if m.date else None,
                "aviso": "Este partido no tiene eventos importados (Wyscout); no hay xG ni mapa de remates."}
    own = next((e.team_name for e in events if e.is_own_team), None)
    b = compute_match_analytics(events, own_team=own)
    # Compact headline numbers (the full bundle is too large for the LLM).
    teams = b["meta"]["teams"]
    return {
        "fecha": m.date.isoformat() if m.date else None,
        "equipos": teams, "marcador": b["scoreline"], "xg": b["xg"],
        "posesion_pct": b["possession_pct"],
        "remates": {t: b["teams"][t]["shots"] for t in teams},
        "remates_al_arco": {t: b["teams"][t]["shots_on_target"] for t in teams},
        "field_tilt_pct": {t: b["teams"][t]["field_tilt_pct"] for t in teams},
    }


def _wellness_plantel(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    days = max(1, min(int(args.get("dias", 3)), 30))
    since = date.today() - timedelta(days=days)
    pids = _club_player_ids(db, user)
    rows = (
        db.query(WellnessEntry, Player).join(Player)
        .filter(WellnessEntry.entry_date >= since, WellnessEntry.player_id.in_(pids))
        .order_by(WellnessEntry.entry_date.desc()).all()
    )
    items, alerts = [], []
    for w, p in rows[:80]:
        score = round(w.wellness_score or 0, 1)
        rec = {"jugador": p.full_name, "fecha": str(w.entry_date), "score": score,
               "fatiga": w.fatigue, "sueno": w.sleep_quality, "dolor_muscular": w.muscle_soreness}
        items.append(rec)
        if score and score <= 5:
            alerts.append({"jugador": p.full_name, "score": score})
    return {"dias": days, "registros": items, "alertas_bajo_bienestar": alerts}


def _generar_informe_pre_partido(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    """Action workflow: build + persist a pre-match report; return a download ref."""
    club_id = getattr(user, "club_id", None)
    if not club_id:
        return {"error": "Tu usuario no tiene un club asignado."}
    from ..core.config import settings
    from .workflows import run_prematch_workflow
    provider = None
    if settings.GROQ_API_KEY:
        try:
            from .provider import GroqProvider
            provider = GroqProvider(api_key=settings.GROQ_API_KEY)
        except Exception:  # noqa: BLE001 — template fallback
            provider = None
    row = run_prematch_workflow(
        db, club_id, opponent=args.get("opponent"), match_id=args.get("match_id"),
        provider=provider, created_by=getattr(user, "id", None),
    )
    return {
        "report_id": row.id, "titulo": row.title,
        "resumen": (row.data or {}).get("plan", {}).get("resumen"),
        "descarga_pdf": f"/api/v1/agent/report/{row.id}.pdf",
    }


def _actualizar_dorsal_jugador(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    player_id = int(args["player_id"])
    jersey_number = int(args["jersey_number"])
    p = _player_in_club(db, user, player_id)
    if not p:
        return {"error": "Jugador no encontrado."}
    p.jersey_number = jersey_number
    db.commit()
    return {"success": True, "mensaje": f"Se actualizó el dorsal de {p.full_name} al #{jersey_number}."}


def _eliminar_jugador(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    player_id = int(args["player_id"])
    p = _player_in_club(db, user, player_id)
    if not p:
        return {"error": "Jugador no encontrado."}
    p.is_active = False
    db.commit()
    return {"success": True, "mensaje": f"Se eliminó al jugador {p.full_name}."}


def _crear_categoria_deportiva(db: Session, user: Any, args: Dict[str, Any]) -> Any:
    name = args["nombre"].strip()
    code = args["codigo"].strip().upper()
    min_age = args.get("min_edad")
    max_age = args.get("max_edad")
    club_id = getattr(user, "club_id", 1)
    
    from ..models.category import Category
    exists = db.query(Category).filter(Category.club_id == club_id, (Category.name == name) | (Category.code == code)).first()
    if exists:
        return {"error": f"La categoría '{name}' o código '{code}' ya existe."}
        
    cat = Category(
        name=name, code=code,
        min_age=min_age, max_age=max_age,
        club_id=club_id, is_active=True
    )
    db.add(cat)
    db.commit()
    return {"success": True, "mensaje": f"Categoría '{name}' creada con éxito."}


# ── registry ──────────────────────────────────────────────────────────────────

def build_tools() -> List[Tool]:
    return [
        Tool("listar_jugadores",
             "Lista los jugadores activos del club. Filtros opcionales por posición, estado o búsqueda por nombre.",
             {"type": "object", "properties": {
                 "posicion": {"type": "string", "description": "Código de posición, p.ej. GK, DEF, MID, FWD"},
                 "estado": {"type": "string", "description": "available|injured|recovering|suspended"},
                 "buscar": {"type": "string", "description": "Texto a buscar en el nombre"}}},
             _listar_jugadores),
        Tool("perfil_jugador",
             "Resumen de temporada de un jugador: partidos, minutos, goles, asistencias, rating, distancia y lesiones.",
             {"type": "object", "properties": {"player_id": {"type": "integer"}}, "required": ["player_id"]},
             _perfil_jugador),
        Tool("riesgo_lesion_jugador",
             "Riesgo de lesión (modelo) de un jugador: score 0-100, nivel y factores que lo explican.",
             {"type": "object", "properties": {"player_id": {"type": "integer"}}, "required": ["player_id"]},
             _riesgo_lesion_jugador),
        Tool("riesgo_lesion_plantel",
             "Ranking de riesgo de lesión de todo el plantel activo, de mayor a menor.",
             {"type": "object", "properties": {}},
             _riesgo_lesion_plantel),
        Tool("proyeccion_rendimiento",
             "Proyección de rendimiento de un jugador (índice actual, tendencia y forecast).",
             {"type": "object", "properties": {"player_id": {"type": "integer"}}, "required": ["player_id"]},
             _proyeccion_rendimiento),
        Tool("listar_partidos",
             "Lista los últimos partidos del club con resultado y competencia.",
             {"type": "object", "properties": {"limite": {"type": "integer", "description": "Cuántos partidos (máx 30)"}}},
             _listar_partidos),
        Tool("analitica_partido",
             "Analítica espacial de un partido (xG, posesión, remates, field tilt) si tiene eventos importados.",
             {"type": "object", "properties": {"match_id": {"type": "integer"}}, "required": ["match_id"]},
             _analitica_partido),
        Tool("wellness_plantel",
             "Bienestar reciente del plantel y alertas de jugadores con score bajo.",
             {"type": "object", "properties": {"dias": {"type": "integer", "description": "Ventana en días (máx 30)"}}},
             _wellness_plantel),
        Tool("generar_informe_pre_partido",
             "ACCIÓN: arma y guarda un informe pre-partido (disponibilidad, riesgo, forma, plan) "
             "y devuelve un link de descarga en PDF. Usalo cuando pidan preparar/armar un informe "
             "para un partido. Indicá el rival (opponent) o el match_id si lo sabés.",
             {"type": "object", "properties": {
                 "opponent": {"type": "string", "description": "Nombre del rival"},
                 "match_id": {"type": "integer", "description": "Id del partido (opcional)"}}},
             _generar_informe_pre_partido),
        Tool("actualizar_dorsal_jugador",
             "ACCIÓN: cambia el dorsal de un jugador en la base de datos.",
             {"type": "object", "properties": {
                 "player_id": {"type": "integer", "description": "Id del jugador"},
                 "jersey_number": {"type": "integer", "description": "Nuevo número de camiseta"}},
              "required": ["player_id", "jersey_number"]},
             _actualizar_dorsal_jugador),
        Tool("eliminar_jugador",
             "ACCIÓN: elimina o marca como inactivo a un jugador.",
             {"type": "object", "properties": {
                 "player_id": {"type": "integer", "description": "Id del jugador"}},
              "required": ["player_id"]},
             _eliminar_jugador),
        Tool("crear_categoria_deportiva",
             "ACCIÓN: crea una nueva categoría deportiva (amateur o profesional) en el club.",
             {"type": "object", "properties": {
                 "nombre": {"type": "string", "description": "Nombre de la categoría, p.ej. Senior"},
                 "codigo": {"type": "string", "description": "Código de la categoría, p.ej. SEN"},
                 "min_edad": {"type": "integer", "description": "Edad mínima (opcional)"},
                 "max_edad": {"type": "integer", "description": "Edad máxima (opcional)"}},
              "required": ["nombre", "codigo"]},
             _crear_categoria_deportiva),
    ]


def to_openai_specs(tools: List[Tool]) -> List[dict]:
    return [{"type": "function", "function": {
        "name": t.name, "description": t.description, "parameters": t.parameters,
    }} for t in tools]
