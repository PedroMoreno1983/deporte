"""
Audit + state record for every external import (Wyscout, Catapult, etc.).

This is THE table a club's gerente deportivo will look at when they want to
know "what did we import yesterday and what failed". It also lets us
*re-run* parsers when we improve a mapping without re-uploading the file.
"""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON, Column, DateTime, Enum, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class ImportProvider(str, enum.Enum):
    WYSCOUT      = "wyscout"
    CATAPULT     = "catapult"
    STATSPORTS   = "statsports"
    POLAR        = "polar"
    GARMIN_FIT   = "garmin_fit"
    INSTAT       = "instat"
    GENERIC_CSV  = "generic_csv"


class ImportKind(str, enum.Enum):
    MATCH_EVENTS    = "match_events"
    MATCH_STATS     = "match_stats"
    GPS_SESSION     = "gps_session"
    WELLNESS        = "wellness"
    HRV_RECOVERY    = "hrv_recovery"
    KINESIOLOGY     = "kinesiology"


class ImportStatus(str, enum.Enum):
    PENDING   = "pending"
    PARSING   = "parsing"
    APPLYING  = "applying"
    DONE      = "done"
    FAILED    = "failed"
    PARTIAL   = "partial"   # some rows OK, others skipped


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id              = Column(Integer, primary_key=True, index=True)
    club_id         = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    uploaded_by     = Column(Integer, ForeignKey("users.id"), nullable=True)

    provider        = Column(Enum(ImportProvider), nullable=False, index=True)
    kind            = Column(Enum(ImportKind),     nullable=False, index=True)
    source_filename = Column(String,               nullable=False)
    source_size     = Column(Integer,              nullable=True)  # bytes
    sha256          = Column(String(64),           nullable=True, index=True)

    status          = Column(Enum(ImportStatus), nullable=False, default=ImportStatus.PENDING, index=True)
    rows_total      = Column(Integer,            default=0)
    rows_imported   = Column(Integer,            default=0)
    rows_skipped    = Column(Integer,            default=0)
    errors          = Column(JSON,               nullable=True)  # list of {row, msg}
    summary         = Column(JSON,               nullable=True)  # provider-specific quick view

    notes           = Column(Text,                nullable=True)
    raw_path        = Column(String,              nullable=True)  # uploaded file on disk
    # Upload-time context the file can't carry (player_id for a Garmin file,
    # match_date/opponent for an event export). Persisted so a re-run reuses it.
    options         = Column(JSON,                nullable=True)

    created_at      = Column(DateTime, default=datetime.utcnow,           nullable=False)
    started_at      = Column(DateTime, nullable=True)
    finished_at     = Column(DateTime, nullable=True)

    # ── Relations (lazy strings to avoid circular imports) ───────────
    uploader = relationship("User", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<ImportJob id={self.id} provider={self.provider.value} kind={self.kind.value} "
            f"status={self.status.value} rows={self.rows_imported}/{self.rows_total}>"
        )
