"""Fixtures for executive-report tests.

Isolated in-memory DB + a fully seeded club (players with mixed availability,
matches with results & ratings, injuries, training load, recovery) so the
aggregation can be asserted against known numbers. An autouse fixture points
``DEPORTE_MODEL_ROOT`` at an empty tmp dir, forcing the deterministic heuristic
risk path (no trained model leaks in from a real ./ml_models).
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registers every table on Base.metadata
from app.core.database import Base
from app.models.category import Category
from app.models.club import Club
from app.models.injury import BodyZone, Injury, InjuryMechanism, InjurySeverity
from app.models.match import Match, MatchStat
from app.models.player import Player, PlayerPosition, PlayerStatus
from app.models.recovery import RecoveryRecord
from app.models.training import TrainingSession

TODAY = date.today()


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture(autouse=True)
def _isolate_models(tmp_path, monkeypatch):
    monkeypatch.setenv("DEPORTE_MODEL_ROOT", str(tmp_path / "ml_models"))
    try:
        from app.ml.injury.predictor import reset_cache

        reset_cache()
    except Exception:
        pass
    yield


def _make_club(db, name, slug):
    c = Club(name=name, slug=slug)
    db.add(c)
    db.commit()
    db.refresh(c)
    cat = Category(name="Primera", code="PRI", club_id=c.id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return c, cat


@pytest.fixture()
def seeded(db):
    """Seed one fully-populated club (+ a second club to prove isolation).

    Returns ``(club_id, date_from, date_to)``.
    """
    club, cat = _make_club(db, "Test FC", "test-fc")
    from_d = TODAY - timedelta(days=90)
    to_d = TODAY

    juan = Player(first_name="Juan", last_name="Pérez", date_of_birth=date(1995, 1, 1),
                  position=PlayerPosition.CENTER_FORWARD, jersey_number=9,
                  category_id=cat.id, club_id=club.id, status=PlayerStatus.AVAILABLE)
    diego = Player(first_name="Diego", last_name="Soto", date_of_birth=date(1990, 2, 2),
                   position=PlayerPosition.CENTRAL_MID, jersey_number=8,
                   category_id=cat.id, club_id=club.id, status=PlayerStatus.RECOVERING)
    marco = Player(first_name="Marco", last_name="Ruiz", date_of_birth=date(1996, 3, 3),
                   position=PlayerPosition.GOALKEEPER, jersey_number=1,
                   category_id=cat.id, club_id=club.id, status=PlayerStatus.INJURED)
    db.add_all([juan, diego, marco])
    db.commit()
    for p in (juan, diego, marco):
        db.refresh(p)

    # Matches: V / E / D, with ratings.
    specs = [(60, 3, 1), (40, 2, 2), (20, 0, 1)]
    for days_ago, gf, ga in specs:
        m = Match(date=TODAY - timedelta(days=days_ago), opponent="Rival CD",
                  is_home=True, club_id=club.id, category_id=cat.id,
                  goals_for=gf, goals_against=ga)
        db.add(m)
        db.commit()
        db.refresh(m)
        db.add(MatchStat(player_id=juan.id, match_id=m.id, minutes_played=90,
                         goals=gf, rating=7.5, total_distance_m=10500))
        db.add(MatchStat(player_id=diego.id, match_id=m.id, minutes_played=80,
                         rating=6.5, total_distance_m=9800))
    db.commit()

    # Injuries in the period (days lost = 20 + 8 = 28).
    db.add(Injury(player_id=juan.id, injury_date=TODAY - timedelta(days=40),
                  injury_type="Rotura muscular", body_zone=BodyZone.THIGH_RIGHT,
                  severity=InjurySeverity.GRADE_2, mechanism=InjuryMechanism.NON_CONTACT,
                  actual_days_out=20, is_recovered=True))
    db.add(Injury(player_id=diego.id, injury_date=TODAY - timedelta(days=20),
                  injury_type="Esguince", body_zone=BodyZone.ANKLE_LEFT,
                  severity=InjurySeverity.GRADE_1, mechanism=InjuryMechanism.OVERLOAD,
                  actual_days_out=8, is_recovered=False))
    db.commit()

    # Training load: Juan in ACWR danger zone (1.8), Diego optimal (1.0).
    for i in range(6):
        d = TODAY - timedelta(days=i * 3)
        db.add(TrainingSession(player_id=juan.id, club_id=club.id, session_date=d,
                               session_load=600.0, acwr=1.8, total_distance_m=7000))
        db.add(TrainingSession(player_id=diego.id, club_id=club.id, session_date=d,
                               session_load=450.0, acwr=1.0, total_distance_m=6000))
    db.commit()

    # Objective recovery records.
    for i in range(4):
        d = TODAY - timedelta(days=i * 2)
        db.add(RecoveryRecord(player_id=juan.id, club_id=club.id, record_date=d,
                              hrv_rmssd=60.0, resting_hr=58, sleep_duration_h=7.0,
                              source="polar"))
    db.commit()

    # Second club with its own data — must NOT bleed into Test FC's report.
    other, ocat = _make_club(db, "Otro Club", "otro")
    op = Player(first_name="Ajeno", last_name="Externo", date_of_birth=date(1992, 5, 5),
                position=PlayerPosition.LEFT_WING, jersey_number=11,
                category_id=ocat.id, club_id=other.id, status=PlayerStatus.AVAILABLE)
    db.add(op)
    db.commit()
    db.refresh(op)
    om = Match(date=TODAY - timedelta(days=10), opponent="No Aparece", is_home=False,
               club_id=other.id, category_id=ocat.id, goals_for=9, goals_against=0)
    db.add(om)
    db.add(Injury(player_id=op.id, injury_date=TODAY - timedelta(days=5),
                  injury_type="Otra", body_zone=BodyZone.KNEE_LEFT,
                  severity=InjurySeverity.GRADE_3, mechanism=InjuryMechanism.CONTACT,
                  actual_days_out=99))
    db.commit()

    return club.id, from_d, to_d
