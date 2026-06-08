"""Daily proactive briefing produced by the agent, one row per club per day.

The proactive agent reviews the squad on a schedule and stores its briefing
here (structured signals + a natural-language summary) so the UI can show it
and it isn't recomputed on every view. One per (club, date) — idempotent.
"""
from __future__ import annotations

from sqlalchemy import (
    Column, Date, DateTime, ForeignKey, Integer, String, Text, JSON, UniqueConstraint,
)
from sqlalchemy.sql import func

from ..core.database import Base


class AgentBriefing(Base):
    __tablename__ = "agent_briefings"
    __table_args__ = (UniqueConstraint("club_id", "briefing_date", name="uq_briefing_club_date"),)

    id            = Column(Integer, primary_key=True, index=True)
    club_id       = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    briefing_date = Column(Date, nullable=False, index=True)

    headline      = Column(String, nullable=True)   # one-line takeaway
    summary       = Column(Text, nullable=True)      # narrative (LLM or templated)
    data          = Column(JSON, nullable=True)      # {signals, priorities, ...}
    generated_by  = Column(String, nullable=True)    # "llm" | "template"

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
