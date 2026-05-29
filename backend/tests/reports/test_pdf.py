"""Real PDF generation for the executive report.

These assert structural PDF markers (header, trailer, page tree) rather than
visible text — reportlab may compress content streams, so greppable strings are
not guaranteed, but the object structure always is. ``importorskip`` keeps the
suite green on a host without reportlab (the endpoint degrades to a 503 there).
"""
from __future__ import annotations

from datetime import date

import pytest

pytest.importorskip("reportlab")

from app.reports import build_executive_report, render_executive_pdf


def _assert_valid_pdf(pdf: bytes, *, min_len: int):
    assert isinstance(pdf, (bytes, bytearray))
    assert pdf.startswith(b"%PDF-"), "missing PDF header"
    assert b"%%EOF" in pdf[-2048:], "missing trailer near end of file"
    assert b"/Pages" in pdf, "missing page tree"
    assert b"/Type" in pdf
    assert len(pdf) > min_len


def test_renders_valid_multipage_pdf(db, seeded):
    club_id, from_d, to_d = seeded
    report = build_executive_report(db, club_id=club_id, date_from=from_d, date_to=to_d)
    pdf = render_executive_pdf(report)
    # Rich report (KPIs + charts + tables across a PageBreak) is comfortably big.
    _assert_valid_pdf(pdf, min_len=5000)


def test_renders_on_empty_club(db, seeded):
    """No players, no matches, no load — every chart/table hits its empty branch
    and the document must still be a valid PDF, not raise."""
    # A club_id with nothing attached: squad 0, all sections empty.
    report = build_executive_report(
        db, club_id=999_999, date_from=date(2024, 1, 1), date_to=date(2024, 3, 31)
    )
    assert report.club_name == "Club #999999"
    assert report.kpi.squad_size == 0
    assert report.risk_outlook == []
    pdf = render_executive_pdf(report)
    _assert_valid_pdf(pdf, min_len=1500)


def test_render_is_deterministic_in_size(db, seeded):
    """Two renders of the same report differ only by timestamp/IDs, so sizes stay
    close — a cheap guard against accidental nondeterministic blow-up."""
    club_id, from_d, to_d = seeded
    report = build_executive_report(db, club_id=club_id, date_from=from_d, date_to=to_d)
    a = render_executive_pdf(report)
    b = render_executive_pdf(report)
    assert abs(len(a) - len(b)) < 512
