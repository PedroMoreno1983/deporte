"""Match analytics orchestrator.

``compute_match_analytics(events)`` turns a flat list of ``MatchEvent`` rows
(or plain dicts) into a JSON-serialisable analytics bundle: per-team xG, shot
maps, an xG timeline, pass networks, possession, field tilt and a territory
grid. Pure Python; safe to call from an API request handler.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Sequence

from .pitch import zone_index, is_valid_xy
from .xg import shot_records, is_shot, is_goal
from .passing import pass_summary, pass_network, is_pass

FINAL_THIRD_X = 66.67
TERRITORY_COLS = 6
TERRITORY_ROWS = 4


def _field(ev: Any, name: str) -> Any:
    return ev.get(name) if isinstance(ev, dict) else getattr(ev, name, None)


def _ordered_teams(events: Sequence[Any]) -> List[str]:
    """Distinct team names in first-seen order (typically the two sides)."""
    seen: List[str] = []
    for ev in events:
        t = _field(ev, "team_name")
        if t and t not in seen:
            seen.append(t)
    return seen


def _xg_timeline(shots: List[dict], team: str) -> List[dict]:
    """Cumulative-xG step points for a team's located shots, ordered by minute.

    Includes every located shot (so the final cumulative equals the team's
    ``xg_total``); a shot missing a minute is coalesced to 0 to keep the x-axis
    numeric for charting.
    """
    pts = sorted(
        (s for s in shots if s.get("team") == team),
        key=lambda s: s["minute"] if s.get("minute") is not None else 0,
    )
    cum = 0.0
    out = []
    for s in pts:
        cum += s["xg"]
        out.append({
            "minute": s["minute"] if s.get("minute") is not None else 0,
            "xg": round(s["xg"], 4),
            # Round to 3 dp to match xg_total's precision so the final
            # cumulative equals the reported team total exactly.
            "cumulative": round(cum, 3),
            "is_goal": s["is_goal"],
        })
    return out


def _territory(events: Sequence[Any], team: str) -> List[List[int]]:
    """Zone-occupancy grid (rows x cols) of a team's located on-ball events."""
    grid = [[0] * TERRITORY_COLS for _ in range(TERRITORY_ROWS)]
    for ev in events:
        if _field(ev, "team_name") != team:
            continue
        x, y = _field(ev, "x"), _field(ev, "y")
        if not is_valid_xy(x, y):
            continue
        col, row = zone_index(x, y, cols=TERRITORY_COLS, rows=TERRITORY_ROWS)
        grid[row][col] += 1
    return grid


def _final_third_touches(events: Sequence[Any], team: str) -> int:
    n = 0
    for ev in events:
        if _field(ev, "team_name") != team:
            continue
        x, y = _field(ev, "x"), _field(ev, "y")
        if is_valid_xy(x, y) and x >= FINAL_THIRD_X:
            n += 1
    return n


def compute_match_analytics(
    events: Sequence[Any], *, own_team: Optional[str] = None,
) -> Dict[str, Any]:
    """Compute the full analytics bundle for one match's events."""
    teams = _ordered_teams(events)
    located_shots = shot_records(events)   # shots with a usable location (for xG + map)

    # Possession proxy: share of attempted passes (a standard, defensible proxy).
    pass_counts = Counter(
        _field(ev, "team_name") for ev in events
        if is_pass(ev) and _field(ev, "team_name")
    )
    total_passes = sum(pass_counts.values()) or 1

    # Field tilt: a team's share of final-third touches.
    ft_counts = {t: _final_third_touches(events, t) for t in teams}
    total_ft = sum(ft_counts.values()) or 1

    per_team: Dict[str, Any] = {}
    for t in teams:
        # Count shots/goals/on-target from ALL shot events (a goal/shot is real
        # even if the export omits its coordinates); xG and the shot map use the
        # subset that has a usable location.
        shot_events = [ev for ev in events if is_shot(ev) and _field(ev, "team_name") == t]
        shots = len(shot_events)
        goals = sum(1 for ev in shot_events if is_goal(ev))
        on_target = sum(
            1 for ev in shot_events
            if is_goal(ev) or str(_field(ev, "outcome")).lower() in {"on_target", "goal"}
        )
        t_shots = [s for s in located_shots if s.get("team") == t]
        xg_total = round(sum(s["xg"] for s in t_shots), 3)
        per_team[t] = {
            "is_own_team": (own_team == t) if own_team else None,
            "shots": shots,
            "shots_on_target": on_target,
            "goals": goals,
            "xg_total": xg_total,
            "xg_per_shot": round(xg_total / shots, 3) if shots else 0.0,
            "shot_map": t_shots,
            "xg_timeline": _xg_timeline(located_shots, t),
            "passing": pass_summary(events, t),
            "pass_network": pass_network(events, t),
            "possession_pct": round(pass_counts.get(t, 0) / total_passes * 100, 1),
            "field_tilt_pct": round(ft_counts.get(t, 0) / total_ft * 100, 1),
            "territory": _territory(events, t),
        }

    return {
        "meta": {
            "n_events": len(events),
            "n_shots": sum(1 for ev in events if is_shot(ev)),
            "teams": teams,
            "own_team": own_team,
            "territory_grid": {"cols": TERRITORY_COLS, "rows": TERRITORY_ROWS},
        },
        "scoreline": {t: per_team[t]["goals"] for t in teams},
        "xg": {t: per_team[t]["xg_total"] for t in teams},
        "possession_pct": {t: per_team[t]["possession_pct"] for t in teams},
        "teams": per_team,
    }
