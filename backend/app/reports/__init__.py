"""Executive reporting: board-level KPIs aggregated from the platform's data,
rendered to PDF.

Two layers, deliberately split (testable independently, same numbers in JSON
and PDF):
    aggregate.build_executive_report → ExecutiveReport   (pure DB, no reportlab)
    pdf.render_executive_pdf         → bytes              (reportlab, lazy)
"""
from .aggregate import ExecutiveReport, build_executive_report

__all__ = ["ExecutiveReport", "build_executive_report", "render_executive_pdf"]


def render_executive_pdf(report: "ExecutiveReport") -> bytes:
    """Thin re-export that defers importing reportlab until actually called."""
    from .pdf import render_executive_pdf as _render

    return _render(report)
