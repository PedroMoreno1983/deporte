"""
External-data import subsystem.

Every provider implements `BaseImporter`. The orchestrator (`run_import`)
takes care of: storing the file, creating the `ImportJob` row, calling the
parser, applying rows to the DB, accumulating errors, and updating the job
status. Adding a new provider = subclass + one entry in `_REGISTRY`.

Why this exists: clubes de Primera ya tienen Wyscout / Catapult / Polar /
STATSports. Nuestro valor no es generar esos datos, es CRUZARLOS con
nuestro plantel, lesiones y wellness. Sin parsers que aspiren esos
exports, Deporte FC es "otra plataforma más"; con ellos somos la única
capa que une todo.
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Type

from sqlalchemy.orm import Session

from ..models.import_job import (
    ImportJob, ImportKind, ImportProvider, ImportStatus,
)
from .base import BaseImporter, ImportResult
from .wyscout    import WyscoutEventsImporter, WyscoutMatchStatsImporter
from .catapult   import CatapultSessionImporter
from .statsports import StatSportsSessionImporter
from .polar      import PolarRecoveryImporter
from .garmin     import GarminFitImporter

log = logging.getLogger("imports")


# Registry: (provider, kind) → importer class
_REGISTRY: Dict[tuple, Type[BaseImporter]] = {
    (ImportProvider.WYSCOUT,    ImportKind.MATCH_EVENTS): WyscoutEventsImporter,
    (ImportProvider.WYSCOUT,    ImportKind.MATCH_STATS ): WyscoutMatchStatsImporter,
    (ImportProvider.CATAPULT,   ImportKind.GPS_SESSION ): CatapultSessionImporter,
    (ImportProvider.STATSPORTS, ImportKind.GPS_SESSION ): StatSportsSessionImporter,
    (ImportProvider.POLAR,      ImportKind.HRV_RECOVERY): PolarRecoveryImporter,
    (ImportProvider.GARMIN_FIT, ImportKind.GPS_SESSION ): GarminFitImporter,
}


def get_importer(provider: ImportProvider, kind: ImportKind) -> Optional[Type[BaseImporter]]:
    return _REGISTRY.get((provider, kind))


def supported_pairs() -> list[dict]:
    """For the frontend dropdown — which combinations are available."""
    return [
        {"provider": p.value, "kind": k.value, "label": _label(p, k)}
        for (p, k), cls in _REGISTRY.items()
    ]


def _label(p: ImportProvider, k: ImportKind) -> str:
    return f"{p.value.replace('_', ' ').title()} — {k.value.replace('_', ' ').title()}"


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run_import(
    db:        Session,
    job:       ImportJob,
    importer:  BaseImporter,
) -> ImportResult:
    """Synchronous orchestrator. Updates `job` in-place."""
    job.status     = ImportStatus.PARSING
    job.started_at = datetime.utcnow()
    db.commit()

    try:
        if job.raw_path and os.path.exists(job.raw_path):
            try:
                job.sha256      = _sha256_file(job.raw_path)
                job.source_size = os.path.getsize(job.raw_path)
            except OSError:  # noqa: BLE001
                pass

        result = importer.parse(Path(job.raw_path))
        job.status = ImportStatus.APPLYING
        db.commit()

        importer.apply(result, db, club_id=job.club_id)

        job.rows_total    = result.rows_total
        job.rows_imported = result.rows_imported
        job.rows_skipped  = result.rows_skipped
        job.errors        = result.errors or None
        job.summary       = result.summary or None
        job.finished_at   = datetime.utcnow()

        if result.rows_imported == 0 and result.rows_skipped > 0:
            job.status = ImportStatus.FAILED
        elif result.rows_skipped > 0:
            job.status = ImportStatus.PARTIAL
        else:
            job.status = ImportStatus.DONE

        db.commit()
        return result
    except Exception as e:  # noqa: BLE001
        log.exception("Import %s failed", job.id)
        job.status      = ImportStatus.FAILED
        job.errors      = [{"row": None, "msg": str(e)}]
        job.finished_at = datetime.utcnow()
        db.commit()
        raise
