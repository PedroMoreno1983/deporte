from datetime import date

from app.imports.catapult import CatapultSessionImporter
from app.models.training import SessionType, TrainingSession

CSV = """Athlete,Jersey,Activity Name,Date,Total Distance (m),High Speed Distance,Sprint Distance,Maximum Velocity,Player Load,Accelerations,Decelerations,Sprints,Duration
Juan Pérez,9,Training Session,2026-05-20,8450.5,820.3,210.1,31.2,512.4,24,19,7,01:35:00
Diego Soto,8,Match vs Rival CD,2026-05-22,10230,1450,520,33.1,640.2,30,28,12,90.0
"""


def _write(tmp_path):
    p = tmp_path / "catapult.csv"
    p.write_text(CSV, encoding="utf-8")
    return p


def test_parse_maps_fields_and_session_type(tmp_path):
    result = CatapultSessionImporter().parse(_write(tmp_path))
    assert result.rows_total == 2
    juan = result.records[0]
    assert juan["session_type"] == SessionType.TRAINING
    assert juan["total_distance_m"] == 8450.5
    assert juan["player_load"] == 512.4
    assert juan["duration_minutes"] == 95          # 01:35:00
    assert juan["max_speed_kmh"] == 31.2
    diego = result.records[1]
    assert diego["session_type"] == SessionType.MATCH   # "Match vs ..."
    assert diego["duration_minutes"] == 90


def test_apply_writes_and_is_idempotent(tmp_path, db, roster):
    importer = CatapultSessionImporter()
    result = importer.parse(_write(tmp_path))
    importer.apply(result, db, club_id=roster[0].club_id)

    assert result.rows_imported == 2
    assert result.rows_skipped == 0
    sessions = db.query(TrainingSession).all()
    assert len(sessions) == 2

    juan = (
        db.query(TrainingSession)
        .filter(TrainingSession.player_id == roster[0].id)
        .one()
    )
    assert juan.session_date == date(2026, 5, 20)
    assert juan.player_load == 512.4
    assert juan.session_type == SessionType.TRAINING

    # Re-running the same import must not duplicate rows.
    importer.apply(result, db, club_id=roster[0].club_id)
    assert db.query(TrainingSession).count() == 2


def test_unknown_player_is_skipped_not_guessed(tmp_path, db, roster):
    csv = CSV + "Nadie Existe,77,Training,2026-05-20,5000,100,50,28,300,10,9,3,60\n"
    p = tmp_path / "c.csv"
    p.write_text(csv, encoding="utf-8")
    importer = CatapultSessionImporter()
    result = importer.parse(p)
    importer.apply(result, db, club_id=roster[0].club_id)
    assert result.rows_imported == 2
    assert result.rows_skipped == 1
    assert any("Nadie Existe" in e["msg"] for e in result.errors)
