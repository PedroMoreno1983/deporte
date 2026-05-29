"""Fixtures for injury-model tests.

Mirrors the importer test harness: an isolated in-memory SQLite DB (StaticPool
so the schema survives commits) plus a seeded club + roster. Adds two
model-specific safeguards:

* ``_isolate_models`` (autouse) points ``DEPORTE_MODEL_ROOT`` at a fresh tmp dir
  for every test and clears the predictor's process-wide cache, so tests never
  read or write a real ``./ml_models`` directory and never leak a model between
  each other.
"""
from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registers every table on Base.metadata
from app.core.database import Base
from app.models.category import Category
from app.models.club import Club
from app.models.player import Player, PlayerPosition


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


@pytest.fixture()
def club(db):
    c = Club(name="Test FC", slug="test-fc")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture()
def roster(db, club):
    cat = Category(name="Primera", code="PRI", club_id=club.id)
    db.add(cat)
    db.commit()
    db.refresh(cat)

    players = [
        Player(first_name="Juan", last_name="Pérez", date_of_birth=date(1995, 1, 1),
               position=PlayerPosition.CENTER_FORWARD, jersey_number=9,
               category_id=cat.id, club_id=club.id),
        Player(first_name="Diego", last_name="Soto", date_of_birth=date(1990, 2, 2),
               position=PlayerPosition.CENTRAL_MID, jersey_number=8,
               category_id=cat.id, club_id=club.id),
    ]
    db.add_all(players)
    db.commit()
    for p in players:
        db.refresh(p)
    return players


@pytest.fixture(autouse=True)
def _isolate_models(tmp_path, monkeypatch):
    """Every test gets a private, empty model dir and a clean predictor cache."""
    monkeypatch.setenv("DEPORTE_MODEL_ROOT", str(tmp_path / "ml_models"))
    from app.ml.injury.predictor import reset_cache

    reset_cache()
    yield
    reset_cache()
