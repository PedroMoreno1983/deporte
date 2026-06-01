"""Verified-backup system (compliance #13).

Exercises the full SQLite path end-to-end against a real on-disk database:
snapshot → gzip → checksum → restore-and-verify, plus retention and the
append-only manifest. The pivotal assertion is that verification actually
*catches* corruption — a backup that can't be restored must be reported as NOT
verified, otherwise "backup verificado" is a lie.
"""
from __future__ import annotations

import gzip
import sqlite3
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — registers every table on Base.metadata
from app.core.backup import (
    _verify_sqlite,
    load_manifest,
    prune_old_backups,
    run_backup,
    sha256_file,
)
from app.core.database import Base
from app.models.wellness import WellnessEntry

N_ROWS = 5


@pytest.fixture
def seeded_engine(tmp_path):
    """A real on-disk SQLite DB with a known number of rows."""
    db_file = tmp_path / "deporte.db"
    eng = create_engine(f"sqlite:///{db_file.as_posix()}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng)
    s = Session()
    try:
        for i in range(N_ROWS):
            s.add(WellnessEntry(
                player_id=1, entry_date=date(2026, 3, 1),
                sleep_quality=5, fatigue=5, mood=5, muscle_soreness=5, stress=5,
                notes=f"registro {i}",
            ))
        s.commit()
    finally:
        s.close()
    try:
        yield eng
    finally:
        eng.dispose()  # release the pool so Windows can clean up tmp_path


def _bdir(tmp_path) -> str:
    return str(tmp_path / "backups")


def test_backup_creates_verified_artifact(seeded_engine, tmp_path):
    res = run_backup(bind=seeded_engine, backup_dir=_bdir(tmp_path), retention=0)

    artifact = Path(res.artifact)
    assert artifact.exists() and artifact.name.endswith(".sqlite.gz")
    assert res.verified is True
    assert res.verification["integrity_check"] == "ok"
    assert res.verification["row_counts_match"] is True
    # The seeded table is present with exactly the rows we inserted.
    assert res.row_counts["wellness_entries"] == N_ROWS

    # The .sha256 sidecar exists and matches the artifact's real digest.
    sidecar = artifact.with_name(artifact.name + ".sha256")
    assert sidecar.exists()
    assert sidecar.read_text(encoding="utf-8").split()[0] == sha256_file(artifact) == res.sha256


def test_artifact_is_a_restorable_database(seeded_engine, tmp_path):
    # Prove restorability independently of the verifier: decompress and query.
    res = run_backup(bind=seeded_engine, backup_dir=_bdir(tmp_path), retention=0)
    restored = tmp_path / "restored.sqlite"
    with gzip.open(res.artifact, "rb") as fin, open(restored, "wb") as fout:
        fout.write(fin.read())

    conn = sqlite3.connect(str(restored))
    try:
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert conn.execute("SELECT COUNT(*) FROM wellness_entries").fetchone()[0] == N_ROWS
    finally:
        conn.close()


def test_tampered_artifact_fails_verification(seeded_engine, tmp_path):
    res = run_backup(bind=seeded_engine, backup_dir=_bdir(tmp_path), retention=0)
    assert res.verified is True

    artifact = Path(res.artifact)
    blob = bytearray(artifact.read_bytes())
    mid = len(blob) // 2
    for i in range(mid, min(mid + 64, len(blob))):
        blob[i] ^= 0xFF
    artifact.write_bytes(bytes(blob))

    verdict = _verify_sqlite(artifact, res.row_counts)
    assert verdict["ok"] is False  # corruption MUST be caught


def test_verification_detects_missing_rows(seeded_engine, tmp_path):
    # A structurally-valid backup whose contents don't match the expected
    # snapshot (e.g. silent truncation) must still fail verification.
    res = run_backup(bind=seeded_engine, backup_dir=_bdir(tmp_path), retention=0)
    inflated = dict(res.row_counts)
    inflated["wellness_entries"] += 1  # claim one more row than the artifact holds

    verdict = _verify_sqlite(Path(res.artifact), inflated)
    assert verdict["integrity_check"] == "ok"
    assert verdict["row_counts_match"] is False
    assert verdict["ok"] is False


def test_retention_keeps_only_newest(seeded_engine, tmp_path):
    bdir = _bdir(tmp_path)
    for _ in range(4):
        run_backup(bind=seeded_engine, backup_dir=bdir, retention=2)

    assert len(list(Path(bdir).glob("*.sqlite.gz"))) == 2
    assert len(list(Path(bdir).glob("*.sqlite.gz.sha256"))) == 2  # sidecars pruned in lockstep
    # The manifest is append-only — full history survives pruning.
    assert len(load_manifest(bdir)) == 4


def test_prune_is_noop_within_retention(seeded_engine, tmp_path):
    bdir = _bdir(tmp_path)
    run_backup(bind=seeded_engine, backup_dir=bdir, retention=5)
    run_backup(bind=seeded_engine, backup_dir=bdir, retention=5)

    assert prune_old_backups(bdir, 5) == []
    assert len(list(Path(bdir).glob("*.sqlite.gz"))) == 2
