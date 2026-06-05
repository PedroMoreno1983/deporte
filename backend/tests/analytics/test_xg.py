"""xG model: calibration, monotonicity, event handling.

Pure-python — no heavy deps, so these always run.
"""
from __future__ import annotations

from app.analytics import xg


# ── Calibration ───────────────────────────────────────────────────────────────
def test_coefficients_are_physically_signed():
    # A wider view of goal raises xG; more distance lowers it.
    assert xg.B_ANGLE > 0
    assert xg.B_DISTANCE < 0


def test_reference_shots_reproduced_within_tolerance():
    for x, y, ref in xg.REFERENCE_SHOTS:
        model = xg.xg_for_location(x, y)
        assert abs(model - ref) <= 0.07, f"({x},{y}) ref={ref} model={model}"


def test_xg_in_unit_interval_everywhere():
    for x in range(0, 101, 5):
        for y in range(0, 101, 10):
            v = xg.xg_for_location(x, y)
            assert 0.0 < v < 1.0


# ── Monotonicity ────────────────────────────────────────────────────────────--
def test_xg_decreases_with_distance_central():
    xs = [96.2, 94.3, 92.4, 89.5, 84.3, 79.0, 71.4, 60.0]
    vals = [xg.xg_for_location(x, 50) for x in xs]
    assert all(a >= b for a, b in zip(vals, vals[1:]))


def test_xg_increases_with_angle_at_fixed_distance():
    # Central vs off-centre at the same ~16.5 m distance.
    assert xg.xg_for_location(84.3, 50) > xg.xg_for_location(84.3, 68)
    # And at ~11 m.
    assert xg.xg_for_location(89.5, 50) > xg.xg_for_location(94.0, 63.2)


# ── Event handling ────────────────────────────────────────────────────────────
def test_penalty_is_constant_and_ignores_location():
    ev = {"event_type": "shot", "event_subtype": "penalty", "x": 88, "y": 50}
    assert xg.xg_for_event(ev) == xg.PENALTY_XG
    # Even with no coordinates.
    assert xg.xg_for_event({"event_type": "penalty", "x": None, "y": None}) == xg.PENALTY_XG


def test_non_shot_returns_none():
    assert xg.xg_for_event({"event_type": "pass", "x": 50, "y": 50}) is None
    assert xg.xg_for_event({"event_type": "duel", "x": 50, "y": 50}) is None


def test_penalty_conceding_foul_is_not_a_shot():
    # An infraction whose subtype mentions penalty must NOT become a penalty shot.
    foul = {"event_type": "infraction", "event_subtype": "penalty", "x": 88, "y": 50}
    assert xg.is_penalty(foul) is False
    assert xg.is_shot(foul) is False
    assert xg.xg_for_event(foul) is None


def test_penalty_kick_variants_are_penalties():
    assert xg.is_penalty({"event_type": "shot", "event_subtype": "penalty"}) is True
    assert xg.is_penalty({"event_type": "Free Kick", "event_subtype": "Penalty"}) is True
    assert xg.is_penalty({"event_type": "penalty"}) is True


def test_shot_without_location_returns_none():
    assert xg.xg_for_event({"event_type": "shot", "x": None, "y": None}) is None


def test_shot_accepts_v2_capitalised_type():
    v = xg.xg_for_event({"event_type": "Shot", "x": 94.3, "y": 50})
    assert v is not None and 0.0 < v < 1.0


def test_xg_for_event_matches_location_model_for_open_play():
    ev = {"event_type": "shot", "x": 89.5, "y": 50}
    assert abs(xg.xg_for_event(ev) - round(xg.xg_for_location(89.5, 50), 4)) < 1e-6


def test_shot_records_filters_and_projects():
    events = [
        {"event_type": "pass", "x": 50, "y": 50, "outcome": "successful"},
        {"event_type": "shot", "x": 94.3, "y": 50, "outcome": "goal", "team_name": "UC", "minute": 3},
        {"event_type": "shot", "x": None, "y": None, "outcome": "off_target"},  # dropped
        {"event_type": "shot", "event_subtype": "penalty", "outcome": "goal", "team_name": "CC"},
    ]
    recs = xg.shot_records(events)
    assert len(recs) == 2
    goal = recs[0]
    assert goal["is_goal"] is True and goal["team"] == "UC" and goal["xg"] > 0
    pen = recs[1]
    assert pen["is_penalty"] is True and pen["xg"] == xg.PENALTY_XG
