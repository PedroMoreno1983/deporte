from app.imports.statsports import StatSportsSessionImporter
from app.models.training import TrainingSession

CSV = """Player Name,Number,Date,Session Time,Total Distance (m),High Speed Distance (m),Sprint Distance (m),Max Speed,Number of Sprints,Accelerations,Decelerations,Dynamic Stress Load
Juan Pérez,9,2026-05-21,95:00,8900.0,900.0,250.0,30.5,8,22,20,410.5
"""


def _write(tmp_path):
    p = tmp_path / "statsports.csv"
    p.write_text(CSV, encoding="utf-8")
    return p


def test_dsl_maps_to_player_load_and_extra(tmp_path):
    result = StatSportsSessionImporter().parse(_write(tmp_path))
    rec = result.records[0]
    assert rec["player_load"] == 410.5
    assert rec["extra_metrics"]["dynamic_stress_load"] == 410.5
    assert rec["duration_minutes"] == 95
    assert rec["max_speed_kmh"] == 30.5


def test_apply_persists_extra_metrics(tmp_path, db, roster):
    importer = StatSportsSessionImporter()
    result = importer.parse(_write(tmp_path))
    importer.apply(result, db, club_id=roster[0].club_id)

    assert result.rows_imported == 1
    session = db.query(TrainingSession).one()
    assert session.player_load == 410.5
    assert session.extra_metrics == {"dynamic_stress_load": 410.5}
    assert session.sprints_count == 8
