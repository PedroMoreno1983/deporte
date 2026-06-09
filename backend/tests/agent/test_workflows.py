"""Level-3 workflow: the pre-match report (build → persist → PDF).

In-memory DB; the narrative uses the templated fallback (no LLM in tests).
"""
from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.database import Base
from app.models.club import Club
from app.models.category import Category
from app.models.player import Player, PlayerPosition
from app.models.match import Match
from app.agent.workflows import (
    build_prematch_report, run_prematch_workflow, render_prematch_pdf, render_prematch_docx, get_report,
)
from app.agent.tools import _generar_informe_pre_partido


def _user(club_id, uid=1):
    return SimpleNamespace(id=uid, club_id=club_id, is_superadmin=False, role="ADMIN")


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    c1, c2 = Club(name="Mi Club", slug="mi"), Club(name="Rival Club", slug="riv")
    s.add_all([c1, c2]); s.flush()
    cat = Category(name="P", code="PRD", club_id=c1.id); s.add(cat); s.flush()
    dob = date(2000, 1, 1)
    s.add_all([
        Player(first_name="Ana", last_name="G", date_of_birth=dob, position=PlayerPosition.CENTER_FORWARD, category_id=cat.id, club_id=c1.id),
        Player(first_name="Luis", last_name="D", date_of_birth=dob, position=PlayerPosition.CENTRAL_MID, category_id=cat.id, club_id=c1.id),
    ])
    s.add_all([
        Match(date=date.today() - timedelta(days=3), opponent="Pasado FC", is_home=True, club_id=c1.id, goals_for=1, goals_against=1),
        Match(date=date.today() + timedelta(days=4), opponent="Colo-Colo", is_home=False, club_id=c1.id),
    ])
    s.commit()
    yield s
    s.close()


def test_build_prematch_resolves_next_match(db):
    data = build_prematch_report(db, club_id=1, provider=None)   # no opponent → next upcoming
    assert data["kind"] == "prematch"
    assert data["opponent"] == "Colo-Colo"
    assert data["match_date"] == (date.today() + timedelta(days=4)).isoformat()
    assert "signals" in data and "plan" in data
    assert data["plan"]["resumen"]


def test_build_prematch_by_opponent_name(db):
    data = build_prematch_report(db, club_id=1, opponent="colo", provider=None)
    assert data["opponent"] == "colo"  # echoes requested name
    assert data["plan"]["plan_tactico"]


def test_render_pdf_returns_pdf_bytes(db):
    data = build_prematch_report(db, club_id=1, provider=None)
    pdf = render_prematch_pdf(data, club_name="Mi Club")
    assert isinstance(pdf, (bytes, bytearray)) and pdf[:4] == b"%PDF"
    assert len(pdf) > 1000


def test_render_docx_returns_docx_bytes(db):
    data = build_prematch_report(db, club_id=1, provider=None)
    blob = render_prematch_docx(data, club_name="Mi Club")
    assert isinstance(blob, (bytes, bytearray)) and blob[:2] == b"PK"   # .docx is a zip
    assert len(blob) > 1000


def test_run_workflow_persists_report(db):
    row = run_prematch_workflow(db, 1, opponent="Colo-Colo", provider=None, created_by=1)
    assert row.id is not None and row.kind == "prematch"
    assert get_report(db, 1, row.id) is not None
    assert get_report(db, 2, row.id) is None   # club-scoped: club 2 can't read it


def test_tool_generates_report_and_download_ref(db):
    out = _generar_informe_pre_partido(db, _user(1), {"opponent": "Colo-Colo"})
    assert out["report_id"] and out["descarga_pdf"].endswith(".pdf")
    assert "resumen" in out
