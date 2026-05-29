"""
Base class for GPS session importers (Catapult, STATSports).

Each vendor's `parse()` normalises rows into a common record shape; the shared
`write_gps_sessions` writer turns them into `TrainingSession` rows. Apply is
idempotent on (player, date, type) so re-runs never duplicate.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from .base import BaseImporter, ImportResult
from .persist import write_gps_sessions


class GpsSessionImporter(BaseImporter):
    provider_value: str = "gps"

    def apply(self, result: ImportResult, db: Session, *, club_id: int) -> None:
        imported, skipped = write_gps_sessions(result.records, db, club_id, result)
        result.rows_imported = imported
        result.rows_skipped = skipped
        result.summary = {"gps_sessions": imported, "players_unmatched": skipped}
