"""Shared fixtures for importer tests.

Each test gets an isolated in-memory SQLite DB (StaticPool keeps the single
connection alive so the schema persists across the importer's own commits) and
a seeded club + 3-player roster. Importers take the `db` session as a parameter,
so they exercise the real persistence path without touching the global engine.
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
        Player(first_name="Diego", last_name="Soto", date_of_birth=date(1998, 2, 2),
               position=PlayerPosition.CENTRAL_MID, jersey_number=8,
               category_id=cat.id, club_id=club.id),
        Player(first_name="Marco", last_name="Ruiz", date_of_birth=date(1996, 3, 3),
               position=PlayerPosition.GOALKEEPER, jersey_number=1,
               category_id=cat.id, club_id=club.id),
    ]
    db.add_all(players)
    db.commit()
    for p in players:
        db.refresh(p)
    return players
