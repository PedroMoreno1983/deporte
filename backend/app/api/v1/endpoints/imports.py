"""
External-data import endpoints.

GET  /imports/providers     selectable (provider, kind) pairs for the UI
POST /imports/upload        multipart file + provider + kind → parse & apply (sync)
GET  /imports/              current club's import jobs
GET  /imports/{id}          one job (full errors + summary)
POST /imports/{id}/rerun    re-parse the stored file (e.g. after a mapping fix)

The actual parsing/writing lives in `app.imports`; this layer only handles
auth, tenant scoping, file storage, the ImportJob row, and audit.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ....core.audit import audit
from ....core.database import get_db
from ....core.deps import get_current_club_id, get_current_user, scoped_query
from ....core.permissions import require_permission
from ....imports import get_importer, run_import, supported_pairs
from ....models.import_job import ImportJob, ImportKind, ImportProvider, ImportStatus
from ....models.user import User
from ....schemas.import_job import ImportJobOut, ImportJobSummary, ProviderPair

router = APIRouter()

DATA_ROOT = Path(os.getenv("DEPORTE_IMPORT_ROOT", "./import_data")).resolve()
UPLOAD_DIR = DATA_ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_BYTES = 100 * 1024 * 1024  # 100 MB — event JSONs are the largest


@router.get("/providers", response_model=List[ProviderPair])
def list_providers(
    _user: User = Depends(require_permission("imports:read")),
):
    return supported_pairs()


@router.get("/", response_model=List[ImportJobSummary])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("imports:read")),
):
    q = db.query(ImportJob).order_by(ImportJob.created_at.desc())
    q = scoped_query(q, ImportJob, current_user)
    return q.limit(200).all()


@router.get("/{job_id}", response_model=ImportJobOut)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("imports:read")),
):
    job = _scoped_job(db, job_id, current_user)
    return job


@router.post("/upload", response_model=ImportJobOut, status_code=status.HTTP_201_CREATED)
def upload_import(
    file: UploadFile = File(...),
    provider: str = Form(...),
    kind: str = Form(...),
    player_id: Optional[int] = Form(None),
    match_date: Optional[str] = Form(None),
    opponent: Optional[str] = Form(None),
    is_home: Optional[bool] = Form(None),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    club_id: int = Depends(get_current_club_id),
    current_user: User = Depends(require_permission("imports:write")),
):
    importer_cls, prov, knd = _resolve_importer(provider, kind)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in importer_cls.accepted_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"{importer_cls.label}: formato no soportado '{ext or 'desconocido'}'. "
                   f"Esperado: {', '.join(importer_cls.accepted_extensions)}",
        )

    raw_path = _store_upload(file, ext)
    options = _clean_options(player_id, match_date, opponent, is_home)

    job = ImportJob(
        club_id=club_id,
        uploaded_by=current_user.id,
        provider=prov,
        kind=knd,
        source_filename=file.filename or raw_path.name,
        source_size=raw_path.stat().st_size,
        status=ImportStatus.PENDING,
        raw_path=str(raw_path),
        options=options or None,
        notes=(notes.strip() if notes else None),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    audit(
        db, user=current_user,
        action="import.upload",
        entity="ImportJob", entity_id=job.id,
        delta={"provider": prov.value, "kind": knd.value, "filename": file.filename},
    )

    _run(db, job, importer_cls, options)
    db.refresh(job)
    return job


@router.post("/{job_id}/rerun", response_model=ImportJobOut)
def rerun_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("imports:write")),
):
    job = _scoped_job(db, job_id, current_user)
    if not job.raw_path or not os.path.exists(job.raw_path):
        raise HTTPException(status_code=410, detail="El archivo original ya no está disponible para reprocesar")

    importer_cls = get_importer(job.provider, job.kind)
    if importer_cls is None:
        raise HTTPException(status_code=400, detail="Combinación proveedor/tipo no soportada")

    # Reset counters so a re-run reflects only this pass.
    job.rows_total = job.rows_imported = job.rows_skipped = 0
    job.errors = job.summary = None
    db.commit()

    audit(db, user=current_user, action="import.rerun", entity="ImportJob", entity_id=job.id)

    _run(db, job, importer_cls, job.options or {})
    db.refresh(job)
    return job


# ── Helpers ──────────────────────────────────────────────────────────────

def _resolve_importer(provider: str, kind: str):
    try:
        prov = ImportProvider(provider)
        knd = ImportKind(kind)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Proveedor o tipo inválido: '{provider}'/'{kind}'")
    importer_cls = get_importer(prov, knd)
    if importer_cls is None:
        raise HTTPException(
            status_code=400,
            detail=f"Combinación no soportada: {prov.value} / {knd.value}",
        )
    return importer_cls, prov, knd


def _store_upload(file: UploadFile, ext: str) -> Path:
    dest = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    written = 0
    with dest.open("wb") as out:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Archivo supera 100 MB")
            out.write(chunk)
    return dest


def _clean_options(player_id, match_date, opponent, is_home) -> dict:
    opts = {
        "player_id": player_id,
        "match_date": match_date.strip() if isinstance(match_date, str) and match_date.strip() else None,
        "opponent": opponent.strip() if isinstance(opponent, str) and opponent.strip() else None,
        "is_home": is_home,
    }
    return {k: v for k, v in opts.items() if v is not None}


def _run(db: Session, job: ImportJob, importer_cls, options: dict) -> None:
    """Run the importer; on failure leave the job row marked FAILED (don't 500)."""
    importer = importer_cls(options=options)
    try:
        run_import(db, job, importer)
    except Exception:  # noqa: BLE001 — run_import already persisted FAILED + error
        db.rollback()


def _scoped_job(db: Session, job_id: int, current_user: User) -> ImportJob:
    q = db.query(ImportJob).filter(ImportJob.id == job_id)
    q = scoped_query(q, ImportJob, current_user)
    job = q.first()
    if not job:
        raise HTTPException(status_code=404, detail="Importación no encontrada")
    return job
