"""Pitch geometry and the Wyscout coordinate convention.

Coordinates follow Wyscout (what ``app.imports.wyscout`` stores on ``MatchEvent``):
``x`` and ``y`` run 0-100, **always from the acting team's left-to-right
attacking direction**, so the goal a team is attacking is at ``x = 100`` and the
goal-mouth centre is ``y = 50``. We map that onto a standard 105 x 68 m pitch to
compute real distances and angles in metres.
"""
from __future__ import annotations

import math
from typing import Optional, Tuple

# Standard pitch (FIFA recommended) and goal dimensions, in metres.
PITCH_LENGTH_M = 105.0
PITCH_WIDTH_M = 68.0
GOAL_WIDTH_M = 7.32

# The goal a team attacks, in metres: centre of the goal line at x = length.
GOAL_X_M = PITCH_LENGTH_M
GOAL_Y_M = PITCH_WIDTH_M / 2.0
_HALF_GOAL_M = GOAL_WIDTH_M / 2.0
# Goalposts on the goal line.
_POST_LEFT_Y = GOAL_Y_M - _HALF_GOAL_M
_POST_RIGHT_Y = GOAL_Y_M + _HALF_GOAL_M


def to_meters(x: float, y: float) -> Tuple[float, float]:
    """Wyscout (0-100, 0-100) → pitch metres (0-105, 0-68)."""
    return (x / 100.0 * PITCH_LENGTH_M, y / 100.0 * PITCH_WIDTH_M)


def distance_to_goal(x: float, y: float) -> float:
    """Straight-line distance (m) from a Wyscout location to the goal centre."""
    mx, my = to_meters(x, y)
    return math.hypot(GOAL_X_M - mx, GOAL_Y_M - my)


def goal_angle(x: float, y: float) -> float:
    """Angle (radians) subtended by the two goalposts from a Wyscout location.

    This is the standard xG "view of goal" feature: a shot dead-centre sees a
    wide angle, a shot from a tight wing sees a sliver. Uses the triangle / law
    of cosines form that stays well-defined behind and beside the goal line.
    Returns a value in ``[0, pi]``; 0 when there is effectively no view of goal.
    """
    mx, my = to_meters(x, y)
    # Vectors from the shot location to each post.
    ax, ay = (GOAL_X_M - mx, _POST_LEFT_Y - my)
    bx, by = (GOAL_X_M - mx, _POST_RIGHT_Y - my)
    dot = ax * bx + ay * by
    na = math.hypot(ax, ay)
    nb = math.hypot(bx, by)
    if na == 0.0 or nb == 0.0:
        # On a goalpost itself — degenerate; treat as no usable angle.
        return 0.0
    cos_theta = max(-1.0, min(1.0, dot / (na * nb)))
    return math.acos(cos_theta)


def shot_geometry(x: float, y: float) -> Tuple[float, float]:
    """Convenience: ``(distance_m, angle_rad)`` for a shot location."""
    return distance_to_goal(x, y), goal_angle(x, y)


def zone_index(x: float, y: float, *, cols: int = 6, rows: int = 4) -> Tuple[int, int]:
    """Map a Wyscout location to a ``(col, row)`` grid cell for heat/territory.

    ``col`` runs along the attacking axis (0 = own goal, ``cols-1`` = opp. goal).
    Indices are clamped to the grid so boundary values (0 or 100) stay in range.
    """
    col = min(cols - 1, max(0, int(x / 100.0 * cols)))
    row = min(rows - 1, max(0, int(y / 100.0 * rows)))
    return col, row


def is_valid_xy(x: Optional[float], y: Optional[float]) -> bool:
    """True when both coordinates are present and inside the 0-100 pitch box."""
    return (
        x is not None and y is not None
        and 0.0 <= x <= 100.0 and 0.0 <= y <= 100.0
    )
