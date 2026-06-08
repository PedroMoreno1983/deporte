"""Proactive briefing: gathers real, club-scoped signals and builds a briefing
without an LLM (templated fallback). In-memory DB, two clubs.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — register tables
from app.core.database import Base
from app.models.club import Club
from app.models.category import Category
from app.models.player import Player, PlayerPosition
from app.models.injury import Injury, InjurySeverity, InjuryMechanism, BodyZone
from app.models.wellness import WellnessEntry
from app.models.match import Match
from app.agent.briefing import (
    gather_signals, generate_club_briefing, persist_briefing, latest_briefing,
    email_sections, run_for_all_clubs,
)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    c1, c2 = Club(name="Mi", slug="mi"), Club(name="Otro", slug="otro")
    s.add_all([c1, c2]); s.flush()
    cat1 = Category(name="P", code="PRD", club_id=c1.id)
    cat2 = Category(name="P", code="PRD", club_id=c2.id)
    s.add_all([cat1, cat2]); s.flush()
    dob = date(2000, 1, 1)
    p1 = Player(first_name="Ana", last_name="G", date_of_birth=dob, position=PlayerPosition.CENTER_FORWARD, category_id=cat1.id, club_id=c1.id)
    p2 = Player(first_name="Luis", last_name="D", date_of_birth=dob, position=PlayerPosition.CENTRAL_MID, category_id=cat1.id, club_id=c1.id)
    rival = Player(first_name="Riv", last_name="X", date_of_birth=dob, position=PlayerPosition.GOALKEEPER, category_id=cat2.id, club_id=c2.id)
    s.add_all([p1, p2, rival]); s.flush()
    # one active injury + one low-wellness + one match for club 1
    s.add(Injury(player_id=p2.id, injury_type="Desgarro", injury_date=date.today() - timedelta(days=2),
                 severity=InjurySeverity.GRADE_2, mechanism=InjuryMechanism.OVERLOAD, body_zone=BodyZone.THIGH_LEFT,
                 is_recovered=False))
    s.add(WellnessEntry(player_id=p1.id, entry_date=date.today(), wellness_score=3.0,
                        sleep_quality=3, fatigue=3, mood=4, muscle_soreness=7, stress=7))
    s.add(Match(date=date.today() - timedelta(days=3), opponent="Colo-Colo", is_home=True,
                club_id=c1.id, goals_for=2, goals_against=1))
    s.commit()
    yield s
    s.close()


def test_gather_signals_is_club_scoped(db):
    sig = gather_signals(db, club_id=1)
    assert sig["plantel_activo"] == 2                      # only club-1 players
    assert any(i["tipo"] == "Desgarro" for i in sig["lesiones_activas"])
    assert any(w["jugador"] == "Ana G" for w in sig["wellness_bajo"])
    assert sig["forma_reciente"] and sig["forma_reciente"][0]["rival"] == "Colo-Colo"
    # club-2 player must never leak in
    names = {r["jugador"] for r in sig["riesgo_top"]}
    assert "Riv X" not in names


def test_generate_and_persist_briefing(db):
    result = generate_club_briefing(db, club_id=1, provider=None)  # templated path
    assert result["generated_by"] == "template"
    assert result["headline"]
    assert "signals" in result["data"]
    row = persist_briefing(db, 1, result)
    assert row.id is not None
    # idempotent per (club, day): regenerating updates the same row
    row2 = persist_briefing(db, 1, generate_club_briefing(db, 1, provider=None))
    assert row2.id == row.id
    assert latest_briefing(db, 1).id == row.id


def test_email_sections_filters_and_formats():
    sig = {
        "riesgo_top": [{"jugador": "A", "score": 80, "nivel": "high"},
                       {"jugador": "B", "score": 50, "nivel": "medium"}],
        "wellness_bajo": [{"jugador": "C", "score": 3, "fecha": "2026-06-01"}],
        "lesiones_activas": [{"jugador": "D", "tipo": "Desgarro"}],
    }
    secs = email_sections(sig)
    titles = " ".join(s["title"] for s in secs)
    assert "Riesgo" in titles and "Bienestar" in titles and "Lesiones" in titles
    risk_labels = {i["label"] for i in secs[0]["items"]}
    assert "A" in risk_labels and "B" not in risk_labels   # medium excluded from email


def test_run_for_all_clubs_notify_is_safe_without_smtp(db):
    res = run_for_all_clubs(db, provider=None, notify=True)
    assert res and all(("emailed" in e or "error" in e) for e in res)
    # no recipients / SMTP disabled in tests → 0 sent, no crash
    assert all(e.get("emailed", 0) == 0 for e in res if "error" not in e)


def test_empty_club_briefing_is_honest(db):
    # club 2 has one player, no injuries/wellness/matches → no false alarms
    sig = gather_signals(db, club_id=2)
    assert sig["lesiones_activas"] == [] and sig["wellness_bajo"] == []
    result = generate_club_briefing(db, 2, provider=None)
    assert result["headline"]  # still produces a (calm) briefing
