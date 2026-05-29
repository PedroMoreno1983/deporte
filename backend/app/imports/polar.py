"""
Polar (Team Pro / Flow) recovery & HRV export → RecoveryRecord.

Targets the orthostatic / recovery-test CSV (HRV, resting HR, recovery status)
and the nightly recharge export (sleep, HRV). Falls back gracefully when a
column is absent.
"""
from __future__ import annotations

from pathlib import Path

from .base import BaseImporter, ImportResult
from .persist import write_recovery_records
from .tabular import parse_date, pick, read_rows, to_float, to_int


class PolarRecoveryImporter(BaseImporter):
    label = "Polar — Recovery / HRV"
    provider_value = "polar"
    accepted_extensions = (".csv", ".xlsx")

    def parse(self, path: Path) -> ImportResult:
        _headers, rows = read_rows(path)
        result = ImportResult(rows_total=len(rows))

        for row in rows:
            name = pick(row, "Player Name", "Name", "Athlete", "Player")
            rec = {
                "player_name": str(name) if name is not None else None,
                "jersey": to_int(pick(row, "Number", "Jersey")),
                "record_date": parse_date(pick(row, "Date", "Test Date", "Day", "Time")),
                "hrv_rmssd": to_float(pick(row, "HRV", "RMSSD", "HRV (ms)", "Heart Rate Variability")),
                "resting_hr": to_int(pick(row, "Resting Heart Rate", "Resting HR", "RHR", "HR Rest")),
                "sleep_duration_h": _sleep_hours(pick(row, "Sleep Duration", "Sleep Time", "Sleep")),
                "sleep_score": to_int(pick(row, "Sleep Score", "Nightly Recharge", "Recharge Status")),
                "recovery_status": _clean(pick(row, "Recovery Status", "Status", "ANS Charge Status")),
                "readiness": to_float(pick(row, "Readiness", "Recovery", "Recovery Score")),
            }
            result.records.append(rec)

        return result

    def apply(self, result: ImportResult, db, *, club_id: int) -> None:
        imported, skipped = write_recovery_records(
            result.records, db, club_id, result, source="polar",
        )
        result.rows_imported = imported
        result.rows_skipped = skipped
        result.summary = {"recovery_records": imported, "players_unmatched": skipped}


def _sleep_hours(v):
    """Sleep may be hours (float), minutes (>20 ⇒ minutes), or HH:MM."""
    if v is None:
        return None
    s = str(v).strip()
    if ":" in s:
        parts = [float(p) for p in s.split(":") if p != ""]
        if len(parts) >= 2:
            return round(parts[0] + parts[1] / 60, 2)
    f = to_float(v)
    if f is None:
        return None
    return round(f / 60, 2) if f > 20 else round(f, 2)


def _clean(v):
    return str(v).strip() if v is not None and str(v).strip() != "" else None
