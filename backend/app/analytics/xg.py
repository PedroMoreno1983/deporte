"""Expected Goals (xG): probability a shot becomes a goal.

Model
-----
The industry-standard, interpretable xG baseline is a logistic model on two
geometric features (the same two that explain most of the variance in published
StatsBomb / Friends-of-Tracking models):

    * ``distance`` — metres from the shot to the goal centre, and
    * ``angle``    — radians subtended by the two goalposts (the "view of goal").

        xG = sigmoid(b0 + b_angle * angle + b_distance * distance)

Rather than hard-code opaque coefficients, we **fit** ``(b0, b_angle,
b_distance)`` at import time (ordinary least squares, closed-form normal
equations) to a set of documented reference shots whose xG is well established
in public data (see ``REFERENCE_SHOTS``). That keeps the calibration transparent
and reproducible — change the references, the model updates — and well-posed: a
spread of central distances pins the distance decay while off-angle shots pin
the angle effect, so the fit is stable and physically signed (a sign guard
rejects any calibration where a wider angle would *lower* xG).

Penalties are not a geometric shot — every penalty is the same set-piece — so
they take the empirical constant ``PENALTY_XG``.
"""
from __future__ import annotations

import math
from typing import Any, List, Optional, Sequence, Tuple

from .pitch import goal_angle, distance_to_goal, is_valid_xy

# Empirical conversion rate of penalties (StatsBomb long-run ~0.76).
PENALTY_XG = 0.76

# (x, y in Wyscout 0-100, reference xG) — open-play shots whose conversion rate
# is well established. The central column (constant wide angle) pins the
# distance decay; the off-angle rows pin the angle effect. Fitting by least
# squares over the whole set (rather than exact-solving 3 points) keeps the
# model stable and physically signed.
REFERENCE_SHOTS: Tuple[Tuple[float, float, float], ...] = (
    # central, increasing distance
    (96.2, 50.0, 0.55),   #  ~4 m
    (94.3, 50.0, 0.42),   #  ~6 m
    (92.4, 50.0, 0.30),   #  ~8 m
    (89.5, 50.0, 0.19),   # ~11 m (penalty spot)
    (84.3, 50.0, 0.07),   # ~16.5 m (box edge)
    (79.0, 50.0, 0.035),  # ~22 m
    (71.4, 50.0, 0.015),  # ~30 m
    # off-angle (narrower view of goal) at varied distance
    (94.0, 63.2, 0.08),   # ~11 m, off to the side
    (92.0, 70.0, 0.05),   # ~16 m, wide
    (84.3, 68.0, 0.03),   # ~20 m, wide
    (96.0, 74.0, 0.045),  # close to byline, very tight angle
)
# Anchors the unit tests re-check (fit must reproduce these within tolerance).
CALIBRATION_ANCHORS = REFERENCE_SHOTS


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    ez = math.exp(z)
    return ez / (1.0 + ez)


def _logit(p: float) -> float:
    p = min(1.0 - 1e-9, max(1e-9, p))
    return math.log(p / (1.0 - p))


def _solve3(a: List[List[float]], b: List[float]) -> Tuple[float, float, float]:
    """Solve a 3x3 linear system by Cramer's rule (no numpy)."""
    def det3(m: List[List[float]]) -> float:
        return (
            m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
            - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
            + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
        )

    d = det3(a)
    if abs(d) < 1e-12:
        raise ValueError("xG calibration anchors are degenerate (singular system)")
    cols = []
    for i in range(3):
        m = [row[:] for row in a]
        for r in range(3):
            m[r][i] = b[r]
        cols.append(det3(m) / d)
    return cols[0], cols[1], cols[2]


def _calibrate() -> Tuple[float, float, float]:
    """Fit ``(b0, b_angle, b_distance)`` to ``REFERENCE_SHOTS`` by least squares.

    Closed form via the normal equations ``(AᵀA) β = Aᵀt`` where each design row
    is ``[1, angle, distance]`` and the target ``t`` is ``logit(reference xG)``.
    """
    rows: List[List[float]] = []
    targets: List[float] = []
    for x, y, xg in REFERENCE_SHOTS:
        rows.append([1.0, goal_angle(x, y), distance_to_goal(x, y)])
        targets.append(_logit(xg))
    # Normal equations: 3x3 AtA and 3-vector Atb.
    AtA = [[sum(r[i] * r[j] for r in rows) for j in range(3)] for i in range(3)]
    Atb = [sum(rows[k][i] * targets[k] for k in range(len(rows))) for i in range(3)]
    b0, b_angle, b_distance = _solve3(AtA, Atb)
    # Physical-sign guard: a wider view of goal must raise xG and more distance
    # must lower it. If an anchor edit ever violates this, fail loudly rather
    # than ship a model that ranks shots backwards.
    if not (b_angle > 0 and b_distance < 0):
        raise ValueError(
            f"xG calibration produced unphysical coefficients "
            f"(b_angle={b_angle:.3f}, b_distance={b_distance:.3f}); "
            f"check CALIBRATION_ANCHORS."
        )
    return b0, b_angle, b_distance


B0, B_ANGLE, B_DISTANCE = _calibrate()


def xg_for_location(x: float, y: float) -> float:
    """xG for an open-play shot at a Wyscout ``(x, y)`` location, in ``(0, 1)``."""
    angle = goal_angle(x, y)
    dist = distance_to_goal(x, y)
    return _sigmoid(B0 + B_ANGLE * angle + B_DISTANCE * dist)


# ── Event-shape helpers (work on dicts OR duck-typed MatchEvent rows) ─────────

def _field(ev: Any, name: str) -> Any:
    if isinstance(ev, dict):
        return ev.get(name)
    return getattr(ev, name, None)


def _norm(s: Any) -> str:
    return str(s).strip().lower() if s is not None else ""


def is_shot(ev: Any) -> bool:
    """True for any shot event (Wyscout v3 ``shot`` / v2 ``Shot``, plus the
    penalty/free-kick shot subtypes)."""
    et = _norm(_field(ev, "event_type"))
    if et in {"shot", "shots"} or "shot" in et:
        return True
    # A penalty is always a shot for xG, however the export labels it.
    if is_penalty(ev):
        return True
    # Some exports tag free-kick shots only via the subtype.
    sub = _norm(_field(ev, "event_subtype"))
    if et in {"free_kick", "free kick", "set_piece"} and "shot" in sub:
        return True
    return False


def is_penalty(ev: Any) -> bool:
    """True only for a penalty *kick* (a shot), not for a foul/infraction that
    merely concedes one. The subtype carries 'penalt' on many event types
    (e.g. an ``infraction`` that gives a penalty), so a subtype match is only
    trusted on shot/free-kick/set-piece events."""
    et = _norm(_field(ev, "event_type"))
    if "penalt" in et:
        return True
    sub = _norm(_field(ev, "event_subtype"))
    return "penalt" in sub and (
        "shot" in et or et in {"free_kick", "free kick", "set_piece"}
    )


def is_goal(ev: Any) -> bool:
    return _norm(_field(ev, "outcome")) == "goal"


def xg_for_event(ev: Any) -> Optional[float]:
    """xG for a shot event. ``None`` if it is not a shot or has no usable
    location (penalties don't need coordinates — they're a constant)."""
    if not is_shot(ev):
        return None
    if is_penalty(ev):
        return PENALTY_XG
    x, y = _field(ev, "x"), _field(ev, "y")
    if not is_valid_xy(x, y):
        return None
    return round(xg_for_location(float(x), float(y)), 4)


def shot_records(events: Sequence[Any]) -> List[dict]:
    """Project shot events into compact dicts for shot maps / xG aggregation.

    Each record: ``{x, y, xg, outcome, is_goal, is_penalty, team, player_id,
    minute}``. Shots without a usable location (and not penalties) are skipped.
    """
    out: List[dict] = []
    for ev in events:
        if not is_shot(ev):
            continue
        xg = xg_for_event(ev)
        if xg is None:
            continue
        out.append({
            "x": _field(ev, "x"),
            "y": _field(ev, "y"),
            "xg": xg,
            "outcome": _field(ev, "outcome"),
            "is_goal": is_goal(ev),
            "is_penalty": is_penalty(ev),
            "team": _field(ev, "team_name"),
            "player_id": _field(ev, "player_id"),
            "minute": _field(ev, "minute"),
        })
    return out
