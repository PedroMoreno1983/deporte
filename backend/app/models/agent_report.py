"""Reports produced by the agent's action workflows (level 3).

A workflow (e.g. the pre-match report) gathers data, writes a narrative, and
stores the result here as structured JSON. The PDF is rendered on demand from
``data`` (so we don't store binaries), and the row is what the chat links to
("armé el informe — descargalo acá"). One row per generated report.
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, JSON
from sqlalchemy.sql import func

from ..core.database import Base


class AgentReport(Base):
    __tablename__ = "agent_reports"

    id         = Column(Integer, primary_key=True, index=True)
    club_id    = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    kind       = Column(String, nullable=False, default="prematch")  # workflow id
    title      = Column(String, nullable=True)
    subject    = Column(String, nullable=True)   # e.g. the opponent
    data       = Column(JSON, nullable=True)      # the full structured report
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
