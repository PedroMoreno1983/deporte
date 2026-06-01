"""Health data (PHI) is encrypted at rest, transparently round-trips, and the
legacy backfill encrypts pre-existing plaintext idempotently.

Uses the in-memory DB fixtures. The key assertion everywhere: the *raw* stored
bytes are ciphertext (``enc:v1:``) while the ORM attribute reads back plaintext.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import text

from app.models.injury import BodyZone, Injury, InjuryMechanism, InjurySeverity
from app.models.prediction import PredictionScore
from app.models.wellness import WellnessEntry
from app.scripts.encrypt_phi import encrypt_existing


def _raw(db, table, col, row_id):
    return db.execute(
        text(f'SELECT "{col}" FROM "{table}" WHERE id = :id'), {"id": row_id}
    ).scalar_one()


def test_injury_clinical_fields_encrypted_at_rest(db_session):
    db = db_session()
    try:
        inj = Injury(
            player_id=1,
            injury_date=date(2026, 3, 1),
            injury_type="Rotura muscular",
            body_zone=BodyZone.THIGH_LEFT,
            severity=InjurySeverity.GRADE_2,
            mechanism=InjuryMechanism.NON_CONTACT,
            description="Desgarro isquiotibial grado 2, dolor a la palpación",
            treatment="Crioterapia + fisioterapia 3x/semana",
            recovery_milestones='{"week1": "reposo", "week3": "carrera suave"}',
            notes="Antecedente de lesión similar temporada anterior",
        )
        db.add(inj)
        db.commit()
        rid = inj.id
    finally:
        db.close()

    # Raw storage is ciphertext for every protected column.
    db = db_session()
    try:
        for col, plain in [
            ("description", "Desgarro"),
            ("treatment", "Crioterapia"),
            ("recovery_milestones", "week1"),
            ("notes", "Antecedente"),
        ]:
            raw = _raw(db, "injuries", col, rid)
            assert raw.startswith("enc:v1:"), f"{col} not encrypted"
            assert plain not in raw
        # Non-sensitive analytic columns stay plaintext/queryable.
        assert _raw(db, "injuries", "injury_type", rid) == "Rotura muscular"

        # ORM reads decrypt transparently.
        fresh = db.query(Injury).get(rid)
        assert fresh.description.startswith("Desgarro isquiotibial")
        assert fresh.treatment.startswith("Crioterapia")
        assert "week3" in fresh.recovery_milestones
        assert fresh.notes.startswith("Antecedente")
    finally:
        db.close()


def test_wellness_notes_encrypted_at_rest(db_session):
    db = db_session()
    try:
        w = WellnessEntry(
            player_id=1, entry_date=date(2026, 3, 2),
            sleep_quality=4, fatigue=5, mood=6, muscle_soreness=3, stress=7,
            notes="Refiere problemas personales que afectan el sueño",
        )
        db.add(w)
        db.commit()
        rid = w.id
    finally:
        db.close()

    db = db_session()
    try:
        assert _raw(db, "wellness_entries", "notes", rid).startswith("enc:v1:")
        assert db.query(WellnessEntry).get(rid).notes.startswith("Refiere problemas")
    finally:
        db.close()


def test_backfill_encrypts_legacy_plaintext_idempotently(db_session):
    # Simulate a legacy row written before encryption: raw INSERT of plaintext.
    db = db_session()
    engine = db.get_bind()
    try:
        with engine.begin() as conn:
            conn.execute(
                text('INSERT INTO prediction_scores (player_id, notes) VALUES (1, :n)'),
                {"n": "riesgo elevado por carga acumulada"},
            )
        rid = db.execute(
            text("SELECT id FROM prediction_scores ORDER BY id DESC LIMIT 1")
        ).scalar_one()
        # Precondition: stored as plaintext.
        assert _raw(db, "prediction_scores", "notes", rid) == "riesgo elevado por carga acumulada"
    finally:
        db.close()

    # First backfill encrypts exactly that one value.
    assert encrypt_existing(bind=engine) >= 1

    db = db_session()
    try:
        assert _raw(db, "prediction_scores", "notes", rid).startswith("enc:v1:")
        assert db.query(PredictionScore).get(rid).notes == "riesgo elevado por carga acumulada"
    finally:
        db.close()

    # Second run is a no-op (idempotent).
    assert encrypt_existing(bind=engine) == 0
