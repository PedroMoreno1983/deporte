"""
Wyscout exports → MatchEvent (granular events) and MatchStat (per-player stats).

Two importers, two file shapes:

* `WyscoutEventsImporter`   — the events JSON (one match). Tolerates both the
  modern v3 shape (`type.primary`, `location.x`, named `player`/`team`) and the
  older v2 public-dataset shape (`eventName`, `tags`, `positions`). Each event
  becomes a `MatchEvent`; opponent-team events resolve to `player_id = None`.
* `WyscoutMatchStatsImporter` — the per-player advanced-stats CSV/XLSX. Each row
  becomes a `MatchStat` attached to the match.

Neither file reliably tells us *which* side is our club, so the imported `Match`
gets a best-effort opponent label and `notes` flagging it for confirmation — we
never fabricate the metric data, only the human label.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..models.match import Match, MatchStat
from ..models.match_event import MatchEvent
from .base import BaseImporter, ImportResult
from .resolve import PlayerResolver
from .tabular import parse_date, pick, read_rows, speed_to_kmh, to_float, to_int


# ── Events ────────────────────────────────────────────────────────────────

class WyscoutEventsImporter(BaseImporter):
    label = "Wyscout — Eventos de partido"
    provider_value = "wyscout"
    accepted_extensions = (".json",)

    def parse(self, path: Path) -> ImportResult:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        events = _events_list(data)
        result = ImportResult(rows_total=len(events))

        for e in events:
            rec = _normalize_event(e)
            if rec is not None:
                result.records.append(rec)

        result.summary = {"match_meta": _extract_meta(data, events)}
        return result

    def apply(self, result: ImportResult, db, *, club_id: int) -> None:
        meta = (result.summary or {}).get("match_meta", {})
        match = _find_or_create_match(db, club_id, meta, self.options)
        if match is None:
            result.rows_imported = 0
            result.rows_skipped = len(result.records)
            result.add_error(
                None,
                "No se pudo determinar la fecha del partido. El export no la "
                "incluye: indica 'match_date' y 'opponent' al subir el archivo.",
            )
            result.summary = {"events": 0, "reason": "missing_match_date"}
            return

        # Idempotent: a Wyscout events file is the full event set for the match,
        # so replace any previously-imported events for it.
        db.query(MatchEvent).filter(MatchEvent.match_id == match.id).delete()

        resolver = PlayerResolver(db, club_id)
        imported = 0
        without_player = 0
        for rec in result.records:
            name = rec.get("player_name")
            player = resolver.resolve(name=name) if name else None
            if name and player is None:
                without_player += 1
            db.add(MatchEvent(
                match_id=match.id,
                club_id=club_id,
                player_id=player.id if player else None,
                team_name=rec.get("team_name"),
                period=rec.get("period"),
                minute=rec.get("minute"),
                second=rec.get("second"),
                event_sec=rec.get("event_sec"),
                event_type=rec["event_type"],
                event_subtype=rec.get("event_subtype"),
                outcome=rec.get("outcome"),
                x=rec.get("x"), y=rec.get("y"),
                end_x=rec.get("end_x"), end_y=rec.get("end_y"),
                raw=rec.get("raw"),
                source_id=rec.get("source_id"),
            ))
            imported += 1

        db.commit()
        result.rows_imported = imported
        result.rows_skipped = 0
        result.summary = {
            "match_id": match.id,
            "opponent": match.opponent,
            "events": imported,
            "events_without_player": without_player,
        }


def _events_list(data: Any) -> List[Dict[str, Any]]:
    if isinstance(data, list):
        return [e for e in data if isinstance(e, dict)]
    if isinstance(data, dict):
        for key in ("events", "data", "matchEvents"):
            v = data.get(key)
            if isinstance(v, list):
                return [e for e in v if isinstance(e, dict)]
    return []


def _normalize_event(e: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    rec: Dict[str, Any] = {"raw": e}
    sid = e.get("id", e.get("eventId"))
    rec["source_id"] = str(sid) if sid is not None else None

    team = e.get("team") if isinstance(e.get("team"), dict) else {}
    player = e.get("player") if isinstance(e.get("player"), dict) else {}
    rec["team_name"] = team.get("name")
    rec["player_name"] = player.get("name")

    rec["period"] = e.get("matchPeriod")
    rec["minute"] = to_int(e.get("minute"))
    rec["second"] = to_int(e.get("second"))
    rec["event_sec"] = to_float(e.get("eventSec"))

    t = e.get("type")
    if isinstance(t, dict):
        rec["event_type"] = t.get("primary")
        sec = t.get("secondary")
        if isinstance(sec, list):
            rec["event_subtype"] = ", ".join(str(s) for s in sec) if sec else None
        else:
            rec["event_subtype"] = sec
    else:
        rec["event_type"] = e.get("eventName") or (t if isinstance(t, str) else None)
        rec["event_subtype"] = e.get("subEventName")

    loc = e.get("location")
    if isinstance(loc, dict):
        rec["x"] = to_float(loc.get("x"))
        rec["y"] = to_float(loc.get("y"))
    pos = e.get("positions")
    if isinstance(pos, list) and pos:
        if rec.get("x") is None and isinstance(pos[0], dict):
            rec["x"] = to_float(pos[0].get("x"))
            rec["y"] = to_float(pos[0].get("y"))
        if len(pos) > 1 and isinstance(pos[1], dict):
            rec["end_x"] = to_float(pos[1].get("x"))
            rec["end_y"] = to_float(pos[1].get("y"))
    for key in ("pass", "carry", "shot"):
        sub = e.get(key)
        if isinstance(sub, dict) and rec.get("end_x") is None:
            end = sub.get("endLocation")
            if isinstance(end, dict):
                rec["end_x"] = to_float(end.get("x"))
                rec["end_y"] = to_float(end.get("y"))

    rec["outcome"] = _outcome(e)
    return rec if rec.get("event_type") else None


def _outcome(e: Dict[str, Any]) -> Optional[str]:
    p = e.get("pass")
    if isinstance(p, dict) and "accurate" in p:
        return "successful" if p.get("accurate") else "unsuccessful"
    s = e.get("shot")
    if isinstance(s, dict):
        if s.get("isGoal"):
            return "goal"
        if "onTarget" in s:
            return "on_target" if s.get("onTarget") else "off_target"
    tags = e.get("tags")
    if isinstance(tags, list):
        ids = {t.get("id") for t in tags if isinstance(t, dict)}
        if 101 in ids:
            return "goal"
        if 1801 in ids:
            return "successful"
        if 1802 in ids:
            return "unsuccessful"
    return None


def _extract_meta(data: Any, events: List[Dict[str, Any]]) -> Dict[str, Any]:
    container = data if isinstance(data, dict) else {}
    m = container.get("match") if isinstance(container.get("match"), dict) else {}
    meta_obj = container.get("meta") if isinstance(container.get("meta"), dict) else {}

    ext = (
        container.get("matchId") or m.get("matchId") or m.get("wyId")
        or meta_obj.get("matchId")
        or (events[0].get("matchId") if events else None)
    )
    names: List[str] = []
    for src in (container, m, meta_obj):
        teams = src.get("teamsData") or src.get("teams")
        if isinstance(teams, dict):
            for v in teams.values():
                nm = _team_name(v)
                if nm and nm not in names:
                    names.append(nm)
        elif isinstance(teams, list):
            for v in teams:
                nm = _team_name(v)
                if nm and nm not in names:
                    names.append(nm)
    if not names:
        for e in events:
            tm = e.get("team")
            nm = tm.get("name") if isinstance(tm, dict) else None
            if nm and nm not in names:
                names.append(nm)

    return {
        "external_id": str(ext) if ext is not None else None,
        "date": container.get("date") or container.get("dateutc") or m.get("date") or m.get("dateutc"),
        "competition": container.get("competition") or m.get("competitionName") or m.get("competition"),
        "label": container.get("label") or m.get("label"),
        "team_names": names[:4],
    }


def _team_name(v: Any) -> Optional[str]:
    if isinstance(v, dict):
        if isinstance(v.get("team"), dict):
            return v["team"].get("name")
        return v.get("name")
    return None


# ── Per-player advanced stats ───────────────────────────────────────────────

# (MatchStat attribute, header aliases)
_STAT_FIELDS = (
    ("minutes_played",            ("Minutes played", "Minutes", "Min")),
    ("rating",                    ("Rating", "Match rating")),
    ("goals",                     ("Goals",)),
    ("assists",                   ("Assists",)),
    ("shots_total",               ("Shots", "Total shots")),
    ("shots_on_target",           ("Shots on target",)),
    ("key_passes",                ("Key passes",)),
    ("passes_total",              ("Passes", "Total passes")),
    ("passes_completed",          ("Accurate passes", "Completed passes", "Passes accurate")),
    ("tackles",                   ("Sliding tackles", "Tackles")),
    ("interceptions",             ("Interceptions",)),
    ("clearances",                ("Clearances",)),
    ("fouls_committed",           ("Fouls", "Fouls committed")),
    ("fouls_received",            ("Fouls suffered", "Fouls received")),
    ("yellow_cards",              ("Yellow cards", "Yellow card")),
    ("red_cards",                 ("Red cards", "Red card")),
    ("duels_total",               ("Duels", "Total duels")),
    ("duels_won",                 ("Duels won",)),
    ("aerial_duels_total",        ("Aerial duels",)),
    ("aerial_duels_won",          ("Aerial duels won",)),
    ("total_distance_m",          ("Distance", "Total distance", "Distance (m)")),
    ("high_intensity_distance_m", ("High speed running", "HSR", "High intensity distance")),
    ("sprint_distance_m",         ("Sprint distance",)),
    ("sprints_count",             ("Sprints", "Number of sprints")),
    ("accelerations_count",       ("Accelerations",)),
)
_FLOAT_FIELDS = {
    "rating", "total_distance_m", "high_intensity_distance_m",
    "sprint_distance_m", "max_speed_kmh",
}


class WyscoutMatchStatsImporter(BaseImporter):
    label = "Wyscout — Estadísticas por jugador"
    provider_value = "wyscout"
    accepted_extensions = (".csv", ".xlsx")

    def parse(self, path: Path) -> ImportResult:
        _headers, rows = read_rows(path)
        result = ImportResult(rows_total=len(rows))
        first = rows[0] if rows else {}

        result.summary = {"match_meta": {
            "external_id": None,
            "date": pick(first, "Date", "Match date"),
            "competition": pick(first, "Competition", "Tournament"),
            "label": pick(first, "Match", "Fixture"),
            "team_names": _distinct_teams(rows),
        }}

        for row in rows:
            name = pick(row, "Player", "Player Name", "Name")
            rec: Dict[str, Any] = {
                "player_name": str(name) if name is not None else None,
                "jersey": to_int(pick(row, "Number", "Jersey", "Shirt")),
                "started": _to_bool(pick(row, "Started", "Starter", "Lineup")),
                "max_speed_kmh": speed_to_kmh(
                    pick(row, "Max speed", "Top speed", "Maximal speed"), ""
                ),
            }
            for attr, aliases in _STAT_FIELDS:
                raw = pick(row, *aliases)
                rec[attr] = to_float(raw) if attr in _FLOAT_FIELDS else to_int(raw)
            result.records.append(rec)

        return result

    def apply(self, result: ImportResult, db, *, club_id: int) -> None:
        meta = (result.summary or {}).get("match_meta", {})
        match = _find_or_create_match(db, club_id, meta, self.options)
        if match is None:
            result.rows_imported = 0
            result.rows_skipped = len(result.records)
            result.add_error(
                None,
                "No se pudo determinar la fecha del partido. Indica 'match_date' "
                "y 'opponent' al subir el archivo o incluye la columna 'Date'.",
            )
            result.summary = {"match_stats": 0, "reason": "missing_match_date"}
            return

        resolver = PlayerResolver(db, club_id)
        imported = skipped = 0
        for i, rec in enumerate(result.records):
            player = resolver.resolve(jersey=rec.get("jersey"), name=rec.get("player_name"))
            if player is None:
                skipped += 1
                result.add_error(i, f"Jugador no encontrado: '{rec.get('player_name')}'")
                continue
            stat = (
                db.query(MatchStat)
                .filter(MatchStat.match_id == match.id, MatchStat.player_id == player.id)
                .first()
            )
            if stat is None:
                stat = MatchStat(match_id=match.id, player_id=player.id)
                db.add(stat)
            if rec.get("started") is not None:
                stat.started = rec["started"]
            for attr, _aliases in _STAT_FIELDS:
                if rec.get(attr) is not None:
                    setattr(stat, attr, rec[attr])
            if rec.get("max_speed_kmh") is not None:
                stat.max_speed_kmh = rec["max_speed_kmh"]
            imported += 1

        db.commit()
        result.rows_imported = imported
        result.rows_skipped = skipped
        result.summary = {
            "match_id": match.id,
            "opponent": match.opponent,
            "match_stats": imported,
            "players_unmatched": skipped,
        }


def _distinct_teams(rows: List[Dict[str, Any]]) -> List[str]:
    seen: List[str] = []
    for r in rows:
        nm = pick(r, "Team", "Team name")
        if nm and str(nm) not in seen:
            seen.append(str(nm))
    return seen[:4]


def _to_bool(v: Any) -> Optional[bool]:
    if v is None or str(v).strip() == "":
        return None
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "y", "si", "sí", "starter", "start"):
        return True
    if s in ("0", "false", "no", "n", "bench", "sub"):
        return False
    return None


# ── Shared match resolution ─────────────────────────────────────────────────

def _find_or_create_match(
    db, club_id: int, meta: Dict[str, Any], options: Dict[str, Any],
) -> Optional[Match]:
    """Find an imported match by external ref / (date, opponent), else create it.

    Returns None when no date can be determined (neither in the file nor in the
    upload options) — the caller turns that into a clear, actionable error.
    """
    match_date = parse_date(options.get("match_date")) or parse_date(meta.get("date"))
    if match_date is None:
        return None

    team_names = [str(t) for t in (meta.get("team_names") or []) if t]
    opponent = options.get("opponent")
    if not opponent:
        opponent = " / ".join(team_names) if team_names else "Rival (importado)"

    external_id = meta.get("external_id")
    existing: Optional[Match] = None
    if external_id:
        existing = (
            db.query(Match)
            .filter(Match.club_id == club_id, Match.external_ref == str(external_id))
            .first()
        )
    if existing is None:
        existing = (
            db.query(Match)
            .filter(
                Match.club_id == club_id,
                Match.date == match_date,
                Match.opponent == opponent,
            )
            .first()
        )
    if existing is not None:
        return existing

    is_home = options.get("is_home")
    note_bits = []
    if len(team_names) >= 2:
        note_bits.append(f"Equipos: {' vs '.join(team_names[:2])} (confirmar cuál es el propio).")
    if meta.get("label"):
        note_bits.append(str(meta["label"]))

    match = Match(
        date=match_date,
        opponent=str(opponent),
        is_home=bool(is_home) if is_home is not None else True,
        competition=(str(meta["competition"]) if meta.get("competition") else None),
        club_id=club_id,
        external_ref=str(external_id) if external_id else None,
        source="wyscout",
        notes=" ".join(note_bits) or None,
    )
    db.add(match)
    db.flush()  # assign match.id before we attach events/stats
    return match
