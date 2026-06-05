"""End-to-end analytics bundle for one match's events.

Pure-python — no heavy deps, so these always run.
"""
from __future__ import annotations

from app.analytics import compute_match_analytics
from app.analytics.xg import PENALTY_XG


def _match_events():
    return [
        # UC build-up + a good central shot (goal)
        {"event_type": "pass", "outcome": "successful", "team_name": "UC", "player_id": 1, "x": 30, "y": 40, "end_x": 50, "end_y": 45, "minute": 1},
        {"event_type": "pass", "outcome": "successful", "team_name": "UC", "player_id": 2, "x": 50, "y": 45, "end_x": 78, "end_y": 50, "minute": 1},
        {"event_type": "shot", "outcome": "goal", "team_name": "UC", "player_id": 3, "x": 92, "y": 51, "minute": 2},
        # CC: a long ball, an off-target shot, an on-target shot, and a penalty (goal)
        {"event_type": "pass", "outcome": "unsuccessful", "team_name": "CC", "player_id": 10, "x": 40, "y": 60, "end_x": 80, "end_y": 40, "minute": 3},
        {"event_type": "shot", "outcome": "off_target", "team_name": "CC", "player_id": 11, "x": 80, "y": 40, "minute": 5},
        {"event_type": "shot", "outcome": "on_target", "team_name": "CC", "player_id": 12, "x": 88, "y": 50, "minute": 7},
        {"event_type": "shot", "event_subtype": "penalty", "outcome": "goal", "team_name": "CC", "player_id": 12, "x": 88, "y": 50, "minute": 8},
        {"event_type": "pass", "outcome": "successful", "team_name": "CC", "player_id": 10, "x": 60, "y": 50, "end_x": 70, "end_y": 55, "minute": 9},
        {"event_type": "pass", "outcome": "successful", "team_name": "CC", "player_id": 11, "x": 70, "y": 55, "end_x": 85, "end_y": 50, "minute": 9},
    ]


def test_bundle_top_level_shape():
    r = compute_match_analytics(_match_events(), own_team="UC")
    assert r["meta"]["teams"] == ["UC", "CC"]
    assert r["meta"]["n_shots"] == 4
    assert set(r["teams"]) == {"UC", "CC"}
    assert r["scoreline"] == {"UC": 1, "CC": 1}


def test_xg_totals_and_penalty():
    r = compute_match_analytics(_match_events())
    cc = r["teams"]["CC"]
    # CC has 3 shots incl. one penalty -> xG at least the penalty value.
    assert cc["shots"] == 3
    assert cc["xg_total"] >= PENALTY_XG
    # UC's single central shot should be a high-quality chance.
    assert r["teams"]["UC"]["xg_total"] > 0.1


def test_possession_sums_to_100():
    r = compute_match_analytics(_match_events())
    total = sum(r["possession_pct"].values())
    assert abs(total - 100.0) < 0.2


def test_xg_timeline_is_cumulative():
    r = compute_match_analytics(_match_events())
    tl = r["teams"]["CC"]["xg_timeline"]
    cums = [p["cumulative"] for p in tl]
    assert cums == sorted(cums)  # non-decreasing
    assert tl[-1]["cumulative"] == r["teams"]["CC"]["xg_total"]


def test_own_team_flag():
    r = compute_match_analytics(_match_events(), own_team="UC")
    assert r["teams"]["UC"]["is_own_team"] is True
    assert r["teams"]["CC"]["is_own_team"] is False


def test_field_tilt_present_and_bounded():
    r = compute_match_analytics(_match_events())
    for t in r["teams"].values():
        assert 0.0 <= t["field_tilt_pct"] <= 100.0


def test_goal_without_location_still_counts():
    events = [
        {"event_type": "shot", "outcome": "goal", "team_name": "UC", "player_id": 3, "x": None, "y": None, "minute": 10},
        {"event_type": "shot", "outcome": "goal", "team_name": "UC", "player_id": 3, "x": 94.3, "y": 50, "minute": 20},
    ]
    r = compute_match_analytics(events)
    uc = r["teams"]["UC"]
    assert uc["shots"] == 2            # both shots counted, even the coordless one
    assert uc["goals"] == 2            # both goals counted
    assert r["scoreline"]["UC"] == 2
    assert len(uc["shot_map"]) == 1    # only the located shot appears on the map
    assert uc["xg_total"] > 0          # xG from the located shot


def test_handles_empty_events():
    r = compute_match_analytics([])
    assert r["meta"]["teams"] == []
    assert r["scoreline"] == {}
    assert r["teams"] == {}
