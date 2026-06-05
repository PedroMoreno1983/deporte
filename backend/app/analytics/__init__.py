"""Spatial match analytics computed from granular events (``MatchEvent``).

This is the layer the ``MatchEvent`` model was built to feed: xG (expected
goals), shot maps, pass networks and territory/field-tilt — the quantitative
analytics clubs expect from Wyscout/InStat, computed *on top of* the event data
we ingest (see ``app.imports.wyscout``).

Everything here is pure Python (no numpy/torch) operating on plain dicts or
duck-typed ``MatchEvent`` rows, so it is fast to import and trivially testable.
"""
from .pitch import (
    PITCH_LENGTH_M, PITCH_WIDTH_M, GOAL_WIDTH_M,
    to_meters, shot_geometry,
)
from .xg import xg_for_location, xg_for_event, PENALTY_XG
from .engine import compute_match_analytics

__all__ = [
    "PITCH_LENGTH_M", "PITCH_WIDTH_M", "GOAL_WIDTH_M",
    "to_meters", "shot_geometry",
    "xg_for_location", "xg_for_event", "PENALTY_XG",
    "compute_match_analytics",
]
