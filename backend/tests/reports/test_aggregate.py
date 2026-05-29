"""Aggregation correctness for the executive report.

Asserts the seeded club's known numbers (the ``seeded`` fixture is built so every
section has a deterministic expected value), proves tenant isolation (a second
club's data must never bleed in), and checks the payload is JSON-serializable —
the JSON endpoint returns exactly ``report.to_dict()``.
"""
from __future__ import annotations

import json

from app.reports import build_executive_report
from app.reports.aggregate import ExecutiveReport


def _build(db, seeded):
    club_id, from_d, to_d = seeded
    return build_executive_report(db, club_id=club_id, date_from=from_d, date_to=to_d)


# ── header / scope ───────────────────────────────────────────────────────────
def test_header_and_period(db, seeded):
    _, from_d, to_d = seeded
    r = _build(db, seeded)
    assert isinstance(r, ExecutiveReport)
    assert r.club_name == "Test FC"
    assert r.period_from == from_d.isoformat()
    assert r.period_to == to_d.isoformat()
    assert r.category_label == "Todas las categorías"


# ── KPI header ───────────────────────────────────────────────────────────────
def test_kpi_squad_and_availability(db, seeded):
    k = _build(db, seeded).kpi
    assert k.squad_size == 3
    assert (k.available, k.injured, k.recovering, k.suspended) == (1, 1, 1, 0)
    assert k.availability_rate == 33.3


def test_kpi_folds_in_match_load_rating(db, seeded):
    k = _build(db, seeded).kpi
    assert k.matches_played == 3
    assert (k.wins, k.draws, k.losses) == (1, 1, 1)
    assert (k.goals_for, k.goals_against) == (5, 4)
    assert k.points_per_game == 1.33
    assert k.training_sessions == 12          # 6 Juan + 6 Diego
    assert k.avg_team_rating == 7.0           # (7.5·3 + 6.5·3) / 6
    assert k.total_distance_km == 78.0        # (6·7000 + 6·6000) / 1000


# ── match performance ────────────────────────────────────────────────────────
def test_match_performance(db, seeded):
    m = _build(db, seeded).matches
    assert (m.wins, m.draws, m.losses) == (1, 1, 1)
    assert (m.goals_for, m.goals_against) == (5, 4)
    assert m.goal_diff == 1
    assert m.points == 4                       # 3 + 1 + 0
    assert m.points_per_game == 1.33
    assert len(m.matches) == 3
    # Ordered ascending by date → first played is the oldest (60 days ago, the win).
    assert [row.result for row in m.matches] == ["V", "E", "D"]
    assert all(row.opponent == "Rival CD" for row in m.matches)


# ── injury burden ────────────────────────────────────────────────────────────
def test_injury_burden(db, seeded):
    inj = _build(db, seeded).injuries
    assert inj.count_in_period == 2
    assert inj.days_lost == 28                 # 20 + 8
    assert inj.avg_days_out == 14.0
    assert inj.surgeries == 0
    assert inj.by_zone == {"thigh_right": 1, "ankle_left": 1}
    assert inj.by_mechanism == {"non_contact": 1, "overload": 1}
    assert inj.by_severity == {"grade_1": 1, "grade_2": 1}
    assert sum(inj.by_month.values()) == 2


# ── training load ────────────────────────────────────────────────────────────
def test_load_summary_acwr_zones(db, seeded):
    load = _build(db, seeded).load
    assert load.sessions == 12
    assert load.acwr_danger_count == 1         # Juan @ 1.8
    assert load.acwr_optimal_count == 1        # Diego @ 1.0
    assert load.total_load > 0
    assert load.weekly_trend                   # at least one ISO-week bucket
    assert all({"week", "load"} <= set(row) for row in load.weekly_trend)


# ── objective recovery ───────────────────────────────────────────────────────
def test_recovery_summary(db, seeded):
    rec = _build(db, seeded).recovery
    assert rec.records == 4
    assert rec.avg_hrv_rmssd == 60.0
    assert rec.avg_resting_hr == 58.0
    assert rec.avg_sleep_hours == 7.0


# ── ML risk outlook (heuristic path forced by the conftest) ──────────────────
def test_risk_outlook_excludes_injured_and_uses_heuristic(db, seeded):
    r = _build(db, seeded)
    # Marco is INJURED → excluded; only Juan + Diego are forecast.
    assert len(r.risk_outlook) == 2
    names = {it.player_name for it in r.risk_outlook}
    assert names == {"Juan Pérez", "Diego Soto"}
    assert r.model_provenance == "heuristic"
    for it in r.risk_outlook:
        assert it.level in {"low", "medium", "high", "critical"}
        assert 0 <= it.score <= 100
    # Sorted by score descending.
    scores = [it.score for it in r.risk_outlook]
    assert scores == sorted(scores, reverse=True)


# ── tenant isolation: "Otro Club" must never leak in ─────────────────────────
def test_tenant_isolation(db, seeded):
    r = _build(db, seeded)
    # Otro Club played a 9-0 game and logged a grade_3 injury for a 5th player.
    assert r.kpi.goals_for == 5                # not 5 + 9
    assert r.kpi.squad_size == 3               # not 4
    assert r.injuries.count_in_period == 2     # not 3
    assert "grade_3" not in r.injuries.by_severity
    assert "knee_left" not in r.injuries.by_zone
    assert all(
        it.player_name in {"Juan Pérez", "Diego Soto"} for it in r.risk_outlook
    )
    assert "Ajeno Externo" not in {it.player_name for it in r.risk_outlook}


# ── serialization contract (the JSON endpoint returns this verbatim) ─────────
def test_to_dict_is_json_serializable(db, seeded):
    r = _build(db, seeded)
    payload = r.to_dict()
    assert isinstance(payload, dict)
    # Nested dataclasses are recursively converted by asdict.
    assert isinstance(payload["kpi"], dict)
    assert isinstance(payload["risk_outlook"], list)
    assert payload["kpi"]["squad_size"] == 3
    # Must round-trip through JSON without a custom encoder.
    blob = json.dumps(payload)
    assert json.loads(blob)["club_name"] == "Test FC"


# ── empty-period robustness ──────────────────────────────────────────────────
def test_empty_period_yields_zeros_not_crash(db, seeded):
    club_id, _, _ = seeded
    # A window far in the past with no events of any kind.
    from datetime import date

    r = build_executive_report(
        db, club_id=club_id, date_from=date(2000, 1, 1), date_to=date(2000, 12, 31)
    )
    # Squad is still counted (status is current), but events are all zero.
    assert r.kpi.matches_played == 0
    assert r.matches.points == 0
    assert r.matches.points_per_game is None
    assert r.injuries.count_in_period == 0
    assert r.injuries.avg_days_out is None
    assert r.load.sessions == 0
    assert r.recovery.records == 0
    assert json.dumps(r.to_dict())             # still serializable
