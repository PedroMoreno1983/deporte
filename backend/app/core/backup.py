"""Verified database backups (compliance #13).

A backup nobody can restore is not a backup. This module produces a
*self-verifying* snapshot of the database: it dumps, checksums (SHA-256), and
then **restores the artifact into a throwaway location to prove it is intact and
complete** before declaring success. Every run is appended to a JSON-lines
manifest, giving an auditable history of what was backed up and whether it
verified.

Two backends, chosen from the SQLAlchemy URL dialect:

  * **SQLite** (dev / default) — uses the stdlib *online-backup* API for a
    transactionally-consistent snapshot even under concurrent writes, then
    gzips it. Verification re-opens the artifact, runs ``PRAGMA integrity_check``
    and compares per-table row counts against the snapshot that was taken.

  * **PostgreSQL** (prod) — shells out to ``pg_dump -Fc`` (custom format).
    Verification runs ``pg_restore --list`` to prove the archive's catalogue is
    readable end-to-end. Requires the Postgres client binaries (``pg_dump`` /
    ``pg_restore``); when they are missing the run fails loudly rather than
    silently skipping — an unverifiable backup is treated as a failed backup.

Pure standard library — no new dependencies, importable anywhere. The heavy
external tools (``pg_dump``) only run when a Postgres URL is actually used.

CLI::

    python -m app.scripts.backup

Schedule it from cron / a systemd timer; a non-zero exit means verification
failed and someone should be paged.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import logging
import os
import shutil
import sqlite3
import subprocess
import tempfile
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .config import settings
from .database import engine as default_engine

log = logging.getLogger("backup")

MANIFEST_NAME = "manifest.jsonl"
_CHUNK = 1 << 20  # 1 MiB streaming buffer

__all__ = [
    "BackupError",
    "BackupResult",
    "run_backup",
    "prune_old_backups",
    "load_manifest",
    "sha256_file",
]


class BackupError(RuntimeError):
    """Raised when a backup cannot be produced (verification failures are
    reported on the result object, not raised — the artifact still exists)."""


@dataclass
class BackupResult:
    artifact: str
    dialect: str
    created_at: str                       # ISO-8601 UTC
    size_bytes: int
    sha256: str
    duration_seconds: float
    verified: bool
    verification: Dict = field(default_factory=dict)
    row_counts: Dict[str, int] = field(default_factory=dict)

    def summary(self) -> str:
        status = "VERIFIED" if self.verified else "NOT VERIFIED"
        rows = sum(self.row_counts.values())
        return (
            f"[{status}] {self.dialect} backup -> {self.artifact}\n"
            f"  size={self.size_bytes:,} B  sha256={self.sha256}\n"
            f"  tables={len(self.row_counts)}  rows={rows}  took {self.duration_seconds}s"
        )


# ── public API ────────────────────────────────────────────────────────────
def run_backup(
    *,
    bind: Optional[Engine] = None,
    backup_dir: Optional[str | os.PathLike] = None,
    retention: Optional[int] = None,
    verify: bool = True,
    label: Optional[str] = None,
) -> BackupResult:
    """Create one verified backup and return its :class:`BackupResult`.

    The artifact and a ``<artifact>.sha256`` sidecar are written to
    ``backup_dir`` (default ``settings.BACKUP_DIR``); the run is appended to the
    manifest; and — unless ``retention`` is 0 — older artifacts beyond the
    retention count are pruned. Verification failures do **not** raise: the
    artifact is kept and ``result.verified`` is ``False`` so the caller (CLI →
    cron) can alert.
    """
    eng = bind or default_engine
    dialect = eng.dialect.name
    out_dir = _ensure_dir(backup_dir)
    started = time.perf_counter()
    ts = datetime.now(timezone.utc)
    stamp = ts.strftime("%Y%m%dT%H%M%S") + f"{ts.microsecond:06d}Z"
    prefix = _slug(label) if label else _default_prefix(eng)

    if dialect == "sqlite":
        artifact, row_counts = _backup_sqlite(eng, out_dir, prefix, stamp)
    elif dialect in ("postgresql", "postgres"):
        artifact, row_counts = _backup_postgres(eng, out_dir, prefix, stamp)
    else:
        raise BackupError(f"Unsupported database dialect for backup: {dialect!r}")

    digest = sha256_file(artifact)
    _sidecar(artifact).write_text(f"{digest}  {artifact.name}\n", encoding="utf-8")

    verification: Dict = {"performed": False}
    verified = False
    if verify:
        if dialect == "sqlite":
            verification = _verify_sqlite(artifact, row_counts)
        else:
            verification = _verify_postgres(artifact)
        verified = bool(verification.get("ok"))

    result = BackupResult(
        artifact=str(artifact),
        dialect=dialect,
        created_at=ts.isoformat(),
        size_bytes=artifact.stat().st_size,
        sha256=digest,
        duration_seconds=round(time.perf_counter() - started, 3),
        verified=verified,
        verification=verification,
        row_counts=row_counts,
    )
    _append_manifest(out_dir, result)

    if retention is None:
        retention = settings.BACKUP_RETENTION
    if retention and retention > 0:
        pruned = prune_old_backups(out_dir, retention)
        if pruned:
            log.info("Pruned %d old backup artifact(s)", len(pruned))

    if verify and not verified:
        log.error("Backup verification FAILED for %s: %s", artifact.name, verification)
    else:
        log.info(
            "Backup OK: %s (%d bytes, sha256=%s...)",
            artifact.name, result.size_bytes, digest[:12],
        )
    return result


def prune_old_backups(backup_dir: str | os.PathLike, retention: int) -> List[Path]:
    """Keep the ``retention`` most-recent artifacts; delete older ones and their
    ``.sha256`` sidecars. The manifest is never touched. Returns removed paths."""
    out_dir = Path(backup_dir)
    artifacts: List[Path] = []
    for pat in ("*.sqlite.gz", "*.dump"):
        artifacts.extend(out_dir.glob(pat))
    # Newest first: name carries a fixed-width UTC timestamp, mtime breaks ties.
    artifacts.sort(key=lambda p: (p.stat().st_mtime, p.name), reverse=True)

    removed: List[Path] = []
    for old in artifacts[retention:]:
        try:
            old.unlink()
            sidecar = _sidecar(old)
            if sidecar.exists():
                sidecar.unlink()
            removed.append(old)
        except OSError as exc:  # noqa: BLE001
            log.warning("Could not prune %s: %s", old, exc)
    return removed


def load_manifest(backup_dir: str | os.PathLike) -> List[Dict]:
    """Parse the manifest into a list of per-run dicts (oldest → newest)."""
    path = Path(backup_dir) / MANIFEST_NAME
    if not path.exists():
        return []
    out: List[Dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out


def sha256_file(path: str | os.PathLike) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(_CHUNK), b""):
            h.update(chunk)
    return h.hexdigest()


# ── SQLite backend ──────────────────────────────────────────────────────────
def _backup_sqlite(engine: Engine, out_dir: Path, prefix: str, stamp: str) -> Tuple[Path, Dict[str, int]]:
    artifact = _unique(out_dir / f"{prefix}-{stamp}.sqlite.gz")
    src, cleanup = _sqlite_source(engine)
    fd, tmp_name = tempfile.mkstemp(suffix=".sqlite", dir=str(out_dir))
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        dest = sqlite3.connect(str(tmp))
        try:
            with dest:                       # online, transactionally-consistent snapshot
                src.backup(dest)
            row_counts = _sqlite_row_counts(dest)
        finally:
            dest.close()
        with open(tmp, "rb") as fin, gzip.open(artifact, "wb", compresslevel=6) as fout:
            shutil.copyfileobj(fin, fout, _CHUNK)
    finally:
        tmp.unlink(missing_ok=True)
        cleanup()
    return artifact, row_counts


def _sqlite_source(engine: Engine) -> Tuple[sqlite3.Connection, Callable[[], None]]:
    """Return ``(connection, cleanup)``. For a file DB we open a fresh
    connection (owned → close it). For an in-memory DB the data lives only in
    the engine's pooled connection, so we borrow it and just return the
    checkout to the pool on cleanup (closing it would destroy the database)."""
    db_path = engine.url.database
    if db_path and db_path not in (":memory:", ""):
        conn = sqlite3.connect(db_path)
        return conn, conn.close
    raw = engine.raw_connection()
    return raw.driver_connection, raw.close


def _sqlite_row_counts(conn: sqlite3.Connection) -> Dict[str, int]:
    names = [
        r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
    ]
    return {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in names}


def _verify_sqlite(artifact: Path, expected_counts: Dict[str, int]) -> Dict:
    """Restore the gzipped artifact to a temp DB and prove it: integrity check
    must report ``ok`` and every table's row count must match the snapshot."""
    result: Dict = {"performed": True, "method": "pragma_integrity_check+row_counts"}
    fd, tmp_name = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        try:
            with gzip.open(artifact, "rb") as fin, open(tmp, "wb") as fout:
                shutil.copyfileobj(fin, fout, _CHUNK)
        except Exception as exc:  # noqa: BLE001 — corrupt gzip (CRC/zlib) → unverifiable
            result.update(ok=False, error=f"decompress failed: {exc}")
            return result

        conn = None
        try:
            conn = sqlite3.connect(str(tmp))
            integ_row = conn.execute("PRAGMA integrity_check").fetchone()
            integrity = integ_row[0] if integ_row else "<empty>"
            counts = _sqlite_row_counts(conn)
        except sqlite3.DatabaseError as exc:
            result.update(ok=False, error=f"open/read failed: {exc}")
            return result
        finally:
            if conn is not None:
                conn.close()

        counts_match = counts == expected_counts
        result.update(
            integrity_check=integrity,
            row_counts=counts,
            expected_row_counts=expected_counts,
            row_counts_match=counts_match,
            ok=(integrity == "ok" and counts_match),
        )
        return result
    finally:
        tmp.unlink(missing_ok=True)


# ── PostgreSQL backend ───────────────────────────────────────────────────────
def _backup_postgres(engine: Engine, out_dir: Path, prefix: str, stamp: str) -> Tuple[Path, Dict[str, int]]:
    url = engine.url
    artifact = _unique(out_dir / f"{prefix}-{stamp}.dump")
    pg_dump = settings.PG_DUMP_PATH or shutil.which("pg_dump")
    if not pg_dump:
        raise BackupError("pg_dump not found on PATH; set PG_DUMP_PATH")

    env = os.environ.copy()
    if url.password:
        env["PGPASSWORD"] = str(url.password)
    cmd = [
        pg_dump, "--format=custom", "--no-owner", "--no-privileges",
        "--file", str(artifact),
        "--host", url.host or "localhost",
        "--port", str(url.port or 5432),
        "--username", url.username or "postgres",
        url.database or "",
    ]
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if proc.returncode != 0:
        artifact.unlink(missing_ok=True)
        raise BackupError(f"pg_dump failed ({proc.returncode}): {proc.stderr.strip()[:500]}")

    return artifact, _pg_row_counts(engine)


def _pg_row_counts(engine: Engine) -> Dict[str, int]:
    insp = inspect(engine)
    tables = sorted(insp.get_table_names())
    counts: Dict[str, int] = {}
    with engine.connect() as conn:
        for t in tables:
            counts[t] = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar_one()
    return counts


def _verify_postgres(artifact: Path) -> Dict:
    """``pg_restore --list`` reads the whole custom-format archive's table of
    contents; if it succeeds and the catalogue is non-empty, the dump is intact."""
    result: Dict = {"performed": True, "method": "pg_restore --list"}
    pg_restore = settings.PG_RESTORE_PATH or shutil.which("pg_restore")
    if not pg_restore:
        result.update(ok=False, error="pg_restore not found on PATH; set PG_RESTORE_PATH")
        return result

    proc = subprocess.run([pg_restore, "--list", str(artifact)], capture_output=True, text=True)
    if proc.returncode != 0:
        result.update(ok=False, error=f"pg_restore --list failed ({proc.returncode}): {proc.stderr.strip()[:500]}")
        return result

    toc_entries = [ln for ln in proc.stdout.splitlines() if ln.strip() and not ln.lstrip().startswith(";")]
    result.update(ok=len(toc_entries) > 0, toc_entries=len(toc_entries))
    return result


# ── helpers ──────────────────────────────────────────────────────────────────
def _ensure_dir(backup_dir: Optional[str | os.PathLike]) -> Path:
    out = Path(backup_dir).expanduser() if backup_dir else Path(settings.BACKUP_DIR).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    return out


def _append_manifest(out_dir: Path, result: BackupResult) -> None:
    line = json.dumps(asdict(result), ensure_ascii=False)
    with open(out_dir / MANIFEST_NAME, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def _sidecar(artifact: Path) -> Path:
    return artifact.with_name(artifact.name + ".sha256")


def _unique(path: Path) -> Path:
    """Never overwrite an existing artifact. Insert ``-N`` before the (possibly
    compound, e.g. ``.sqlite.gz``) extension so glob patterns still match."""
    if not path.exists():
        return path
    base, dot, ext = path.name.partition(".")
    n = 1
    while True:
        candidate = path.with_name(f"{base}-{n}.{ext}" if dot else f"{base}-{n}")
        if not candidate.exists():
            return candidate
        n += 1


def _default_prefix(engine: Engine) -> str:
    db = engine.url.database or ""
    if db in ("", ":memory:"):
        return "memory"
    base = Path(db).stem if engine.dialect.name == "sqlite" else db
    return _slug(base) or "db"


def _slug(s: str) -> str:
    return "".join(c if (c.isalnum() or c in "-_") else "-" for c in s).strip("-")
