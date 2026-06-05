"""Passing analytics: pass networks and team passing summaries.

Wyscout events carry the *passer* and the pass start/end location but not an
explicit receiver. We infer the receiver with the standard heuristic: the
receiver of a completed pass is the acting player of the next event by the same
team. That is enough to build a credible pass network (nodes = players at their
average involvement location, edges = completed-pass volume between them).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Sequence

from .pitch import is_valid_xy

# A pass is "progressive" if it moves the ball at least this much closer to the
# opponent goal line (along the attacking x-axis, in Wyscout units).
PROGRESSIVE_DELTA_X = 15.0
FINAL_THIRD_X = 66.67  # entry to the attacking third
BOX_X = 84.0           # ~16.5 m penalty-area edge in Wyscout units
BOX_Y_MIN, BOX_Y_MAX = 19.0, 81.0


def _field(ev: Any, name: str) -> Any:
    return ev.get(name) if isinstance(ev, dict) else getattr(ev, name, None)


def _norm(s: Any) -> str:
    return str(s).strip().lower() if s is not None else ""


def is_pass(ev: Any) -> bool:
    return _norm(_field(ev, "event_type")) in {"pass", "passes"}


def _is_completed(ev: Any) -> bool:
    return _norm(_field(ev, "outcome")) == "successful"


def _into_box(ex: Optional[float], ey: Optional[float]) -> bool:
    return ex is not None and ey is not None and ex >= BOX_X and BOX_Y_MIN <= ey <= BOX_Y_MAX


def pass_summary(events: Sequence[Any], team_name: Optional[str] = None) -> Dict[str, Any]:
    """Counting stats for a team's passing (or all teams if ``team_name`` is None)."""
    total = completed = progressive = into_final_third = into_box = 0
    for ev in events:
        if not is_pass(ev):
            continue
        if team_name is not None and _field(ev, "team_name") != team_name:
            continue
        total += 1
        if not _is_completed(ev):
            continue
        completed += 1
        x, ex, ey = _field(ev, "x"), _field(ev, "end_x"), _field(ev, "end_y")
        if x is not None and ex is not None and (ex - x) >= PROGRESSIVE_DELTA_X:
            progressive += 1
        if x is not None and ex is not None and x < FINAL_THIRD_X <= ex:
            into_final_third += 1
        if _into_box(ex, ey):
            into_box += 1
    return {
        "total": total,
        "completed": completed,
        "accuracy": round(completed / total, 3) if total else 0.0,
        "progressive": progressive,
        "into_final_third": into_final_third,
        "into_box": into_box,
    }


def pass_network(events: Sequence[Any], team_name: str) -> Dict[str, Any]:
    """Build a pass network for ``team_name``.

    Returns ``{"nodes": [...], "edges": [...]}`` where each node is a player with
    an average involvement location and pass volume, and each edge is the count
    of completed passes inferred between two team-mates.
    """
    # Per-player accumulators for average location + counts.
    sum_x: Dict[Any, float] = defaultdict(float)
    sum_y: Dict[Any, float] = defaultdict(float)
    cnt: Dict[Any, int] = defaultdict(int)
    passes_made: Dict[Any, int] = defaultdict(int)
    edges: Dict[tuple, int] = defaultdict(int)

    n = len(events)
    for i, ev in enumerate(events):
        if _field(ev, "team_name") != team_name:
            continue
        pid = _field(ev, "player_id")
        x, y = _field(ev, "x"), _field(ev, "y")
        if pid is not None and is_valid_xy(x, y):
            sum_x[pid] += float(x)
            sum_y[pid] += float(y)
            cnt[pid] += 1
        if not (is_pass(ev) and _is_completed(ev) and pid is not None):
            continue
        passes_made[pid] += 1
        # Infer the receiver: next event by the same team with a resolved player.
        for j in range(i + 1, min(i + 6, n)):
            nxt = events[j]
            if _field(nxt, "team_name") != team_name:
                break  # possession changed → no completed reception
            rid = _field(nxt, "player_id")
            if rid is not None and rid != pid:
                edges[(pid, rid)] += 1
                break

    nodes = [
        {
            "player_id": pid,
            "avg_x": round(sum_x[pid] / cnt[pid], 1),
            "avg_y": round(sum_y[pid] / cnt[pid], 1),
            "involvements": cnt[pid],
            "passes": passes_made.get(pid, 0),
        }
        for pid in cnt
    ]
    nodes.sort(key=lambda d: d["involvements"], reverse=True)
    edge_list = [
        {"from": a, "to": b, "count": c}
        for (a, b), c in sorted(edges.items(), key=lambda kv: kv[1], reverse=True)
    ]
    return {"nodes": nodes, "edges": edge_list}
