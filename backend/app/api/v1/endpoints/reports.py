"""Executive report endpoints (board / directorio level).

GET /reports/executive/data   aggregated KPIs as JSON (preview / frontend)
GET /reports/executive.pdf    the same data rendered to a downloadable PDF

Both are tenant-scoped via the caller's club, accept an optional period
(date_from / date_to, default last 90 days) and an optional category filter.
Aggregation lives in ``app.reports``; this layer only handles auth, scoping,
parameter parsing and the HTTP response.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ....core.audit import audit
from ....core.database import get_db
from ....core.deps import get_current_club_id, get_current_user
from ....core.permissions import require_permission
from ....models.user import User
from ....reports import build_executive_report, render_executive_pdf

router = APIRouter()

_DEFAULT_WINDOW_DAYS = 90


def _parse_period(date_from: Optional[str], date_to: Optional[str]) -> tuple[date, date]:
    """Resolve the reporting window; default = last 90 days ending today."""
    try:
        to_d = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else date.today()
        from_d = (
            datetime.strptime(date_from, "%Y-%m-%d").date()
            if date_from else to_d - timedelta(days=_DEFAULT_WINDOW_DAYS)
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida (use YYYY-MM-DD)")
    if from_d > to_d:
        raise HTTPException(status_code=400, detail="date_from no puede ser posterior a date_to")
    return from_d, to_d


@router.get("/executive/data")
def executive_data(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    club_id: int = Depends(get_current_club_id),
    _user: User = Depends(require_permission("reports:read")),
):
    """Aggregated executive report as JSON (same data the PDF renders)."""
    from_d, to_d = _parse_period(date_from, date_to)
    report = build_executive_report(
        db, club_id=club_id, date_from=from_d, date_to=to_d, category_id=category_id
    )
    return report.to_dict()


@router.get("/executive.pdf")
def executive_pdf(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    club_id: int = Depends(get_current_club_id),
    current_user: User = Depends(require_permission("reports:read")),
):
    """Render the executive report to a downloadable PDF."""
    from_d, to_d = _parse_period(date_from, date_to)
    report = build_executive_report(
        db, club_id=club_id, date_from=from_d, date_to=to_d, category_id=category_id
    )

    try:
        pdf_bytes = render_executive_pdf(report)
    except ImportError:
        # reportlab not installed on this host — fail clearly, don't 500.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Generación de PDF no disponible: falta la dependencia 'reportlab'.",
        )

    audit(
        db, user=current_user,
        action="report.executive.pdf",
        entity="Club", entity_id=club_id,
        delta={"from": from_d.isoformat(), "to": to_d.isoformat(), "category_id": category_id},
    )

    filename = f"informe_ejecutivo_{from_d.isoformat()}_{to_d.isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
