"""Passing analytics: summaries and pass-network receiver inference.

Pure-python — no heavy deps, so these always run.
"""
from __future__ import annotations

from app.analytics.passing import pass_summary, pass_network


def _p(pid, x, y, ex, ey, ok=True, team="UC"):
    return {
        "event_type": "pass", "team_name": team, "player_id": pid,
        "x": x, "y": y, "end_x": ex, "end_y": ey,
        "outcome": "successful" if ok else "unsuccessful",
    }


def test_pass_summary_counts():
    events = [
        _p(1, 20, 50, 40, 50),   # progressive (+20), not into final third
        _p(2, 40, 50, 70, 50),   # progressive (+30), into final third
        _p(3, 70, 50, 86, 50),   # progressive (+16), into box
        _p(1, 50, 50, 52, 50, ok=False),  # attempted, not completed, not progressive
    ]
    s = pass_summary(events, "UC")
    assert s["total"] == 4
    assert s["completed"] == 3
    assert s["accuracy"] == round(3 / 4, 3)
    assert s["progressive"] == 3
    assert s["into_final_third"] == 1
    assert s["into_box"] == 1


def test_pass_summary_team_filter():
    events = [_p(1, 20, 50, 40, 50, team="UC"), _p(9, 20, 50, 40, 50, team="CC")]
    assert pass_summary(events, "UC")["total"] == 1
    assert pass_summary(events, "CC")["total"] == 1
    assert pass_summary(events, None)["total"] == 2


def test_pass_network_infers_receiver_from_next_event():
    events = [
        _p(1, 20, 50, 40, 50),   # 1 -> next UC actor (2)
        _p(2, 40, 50, 70, 50),   # 2 -> next UC actor (3)
        _p(3, 70, 50, 86, 50),   # 3 -> next UC actor (1)
        _p(1, 86, 50, 88, 50, ok=False),
    ]
    net = pass_network(events, "UC")
    edges = {(e["from"], e["to"]): e["count"] for e in net["edges"]}
    assert edges.get((1, 2)) == 1
    assert edges.get((2, 3)) == 1
    assert edges.get((3, 1)) == 1
    # Three distinct players as nodes, each with an average location.
    assert {n["player_id"] for n in net["nodes"]} == {1, 2, 3}
    node1 = next(n for n in net["nodes"] if n["player_id"] == 1)
    assert 0 <= node1["avg_x"] <= 100 and node1["involvements"] >= 1


def test_pass_network_possession_change_breaks_chain():
    events = [
        _p(1, 20, 50, 40, 50, team="UC"),      # UC pass...
        {"event_type": "interception", "team_name": "CC", "player_id": 9, "x": 60, "y": 50},
        _p(2, 40, 50, 70, 50, team="UC"),      # ...next UC actor, but possession changed
    ]
    net = pass_network(events, "UC")
    edges = {(e["from"], e["to"]) for e in net["edges"]}
    # No 1->2 edge because a CC event sits between them.
    assert (1, 2) not in edges
