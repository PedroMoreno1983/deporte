from datetime import date

from app.imports.polar import PolarRecoveryImporter
from app.models.recovery import RecoveryRecord

CSV = """Player Name,Date,HRV,Resting Heart Rate,Sleep Duration,Sleep Score,Recovery Status,Readiness
Juan Pérez,2026-05-20,88,52,7:30,82,Good,7.5
Diego Soto,2026-05-20,72,58,420,75,Compromised,5.0
"""


def _write(tmp_path):
    p = tmp_path / "polar.csv"
    p.write_text(CSV, encoding="utf-8")
    return p


def test_sleep_parsing_hhmm_vs_minutes(tmp_path):
    result = PolarRecoveryImporter().parse(_write(tmp_path))
    juan, diego = result.records
    assert juan["sleep_duration_h"] == 7.5    # "7:30"
    assert diego["sleep_duration_h"] == 7.0   # "420" minutes
    assert juan["hrv_rmssd"] == 88.0
    assert juan["recovery_status"] == "Good"


def test_apply_writes_recovery_records(tmp_path, db, roster):
    importer = PolarRecoveryImporter()
    result = importer.parse(_write(tmp_path))
    importer.apply(result, db, club_id=roster[0].club_id)

    assert result.rows_imported == 2
    rows = db.query(RecoveryRecord).all()
    assert len(rows) == 2

    juan = (
        db.query(RecoveryRecord)
        .filter(RecoveryRecord.player_id == roster[0].id)
        .one()
    )
    assert juan.record_date == date(2026, 5, 20)
    assert juan.resting_hr == 52
    assert juan.source == "polar"

    # Idempotent on (player, date).
    importer.apply(result, db, club_id=roster[0].club_id)
    assert db.query(RecoveryRecord).count() == 2
