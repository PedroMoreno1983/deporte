"""Agent tools are club-scoped — the multi-tenant safety guarantee.

Uses an in-memory SQLite DB with two clubs and asserts a club-1 user can never
see club-2 data through the tools (the anti-cross-tenant / anti-hallucination
foundation: the agent can only ground answers in its own club's rows).
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — register all tables on Base.metadata
from app.core.database import Base
from app.models.club import Club
from app.models.category import Category
from app.models.player import Player, PlayerPosition
from app.models.match import Match
from app.agent.tools import _listar_jugadores, _player_in_club, _match_in_club, _analitica_partido


def _user(club_id: int):
    return SimpleNamespace(id=1, club_id=club_id, is_superadmin=False, role="ADMIN")


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    c1, c2 = Club(name="Mi Club", slug="mi"), Club(name="Rival", slug="rival")
    s.add_all([c1, c2]); s.flush()
    cat1 = Category(name="Primera", code="PRD", club_id=c1.id)
    cat2 = Category(name="Primera", code="PRD", club_id=c2.id)
    s.add_all([cat1, cat2]); s.flush()
    from datetime import date
    dob = date(2000, 1, 1)
    s.add_all([
        Player(first_name="Ana", last_name="Gómez", date_of_birth=dob, position=PlayerPosition.CENTER_FORWARD, category_id=cat1.id, club_id=c1.id),
        Player(first_name="Luis", last_name="Díaz", date_of_birth=dob, position=PlayerPosition.CENTRAL_MID, category_id=cat1.id, club_id=c1.id),
        Player(first_name="Rival", last_name="Jugador", date_of_birth=dob, position=PlayerPosition.GOALKEEPER, category_id=cat2.id, club_id=c2.id),
    ])
    s.add_all([
        Match(date=date(2026, 5, 1), opponent="X", is_home=True, club_id=c1.id),
        Match(date=date(2026, 5, 2), opponent="Y", is_home=False, club_id=c2.id),
    ])
    s.commit()
    yield s
    s.close()


def test_listar_jugadores_only_own_club(db):
    r = _listar_jugadores(db, _user(1), {})
    assert r["total"] == 2
    names = {j["nombre"] for j in r["jugadores"]}
    assert names == {"Ana Gómez", "Luis Díaz"}
    assert "Rival Jugador" not in names


def test_player_in_club_blocks_cross_club(db):
    rival = db.query(Player).filter(Player.club_id == 2).first()
    assert _player_in_club(db, _user(1), rival.id) is None      # club-1 user cannot see it
    assert _player_in_club(db, _user(2), rival.id) is not None  # its own club can


def test_match_in_club_blocks_cross_club(db):
    rival_match = db.query(Match).filter(Match.club_id == 2).first()
    assert _match_in_club(db, _user(1), rival_match.id) is None


def test_analitica_partido_without_events_is_honest(db):
    own_match = db.query(Match).filter(Match.club_id == 1).first()
    r = _analitica_partido(db, _user(1), {"match_id": own_match.id})
    assert "aviso" in r  # no inventa xG: avisa que no hay eventos


def test_perfil_jugador_cross_club_returns_error(db):
    from app.agent.tools import _perfil_jugador
    rival = db.query(Player).filter(Player.club_id == 2).first()
    assert _perfil_jugador(db, _user(1), {"player_id": rival.id}) == {"error": "Jugador no encontrado en tu club."}
