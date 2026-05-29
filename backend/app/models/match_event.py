"""
Granular match events (one row per on-ball action).

This is what unlocks real analytics — xG, xT, pass networks, pressing maps —
that clubs expect from Wyscout/InStat. We don't generate the tagging; we
*ingest* it (Wyscout export) and store it at full resolution so our analytics
layer can compute on top of it.

Coordinates use the Wyscout convention: 0-100 on each axis, always from the
acting team's left-to-right attacking direction.
"""
from __future__ import annotations

from sqlalchemy import (
    JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class MatchEvent(Base):
    __tablename__ = "match_events"

    id        = Column(Integer, primary_key=True, index=True)
    match_id  = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    club_id   = Column(Integer, ForeignKey("clubs.id"),   nullable=False, index=True)
    # Nullable: opponent-team events won't resolve to one of our players.
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True, index=True)

    team_name    = Column(String,  nullable=True)   # as named in the source export
    is_own_team  = Column(Boolean, nullable=True)   # None until the user confirms which side is "us"

    # Timing
    period    = Column(String,  nullable=True)      # "1H" / "2H" / "E1" / "E2" / "P"
    minute    = Column(Integer, nullable=True)
    second    = Column(Integer, nullable=True)
    event_sec = Column(Float,   nullable=True)       # seconds within the period

    # What happened
    event_type    = Column(String, nullable=False, index=True)   # pass, shot, duel, foul, ...
    event_subtype = Column(String, nullable=True)                 # cross, through_ball, ...
    outcome       = Column(String, nullable=True)                 # successful / unsuccessful / goal / ...

    # Pitch location (0-100). end_* set for passes/carries/shots.
    x     = Column(Float, nullable=True)
    y     = Column(Float, nullable=True)
    end_x = Column(Float, nullable=True)
    end_y = Column(Float, nullable=True)

    # Provenance: the raw event dict, so we can re-derive fields if our mapping improves.
    raw        = Column(JSON, nullable=True)
    source_id  = Column(String, nullable=True, index=True)   # provider's own event id
    import_job_id = Column(Integer, ForeignKey("import_jobs.id"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    match  = relationship("Match")
    player = relationship("Player")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<MatchEvent id={self.id} match={self.match_id} "
            f"{self.event_type}/{self.event_subtype} min={self.minute}>"
        )
