"""Celery task definitions — thin wrappers over the real domain logic.

Each task delegates to the same function the synchronous path calls, so there
is exactly one implementation of every operation and no behaviour drift between
"ran inline" and "ran on a worker". Heavy / app-specific imports are deferred
into the function bodies so importing this module (which Celery does at boot,
and the API does to enqueue) stays cheap and free of optional dependencies.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from .celery_app import celery_app

log = logging.getLogger("worker.tasks")


# ── CV video analysis (flagship long task) ──────────────────────────────────
@celery_app.task(
    name="deporte.cv.analyze_video",
    bind=True,
    acks_late=True,
    soft_time_limit=3 * 3600,         # a full match clip can legitimately run long
    time_limit=3 * 3600 + 300,
)
def analyze_video_task(self, analysis_id: int, video_path: str, output_dir: str,
                       weights: Optional[str] = None) -> dict:
    """Run the CV pipeline for one ``VideoAnalysis`` row.

    Delegates to :func:`app.cv.runner.process_video`, which owns all DB-status
    transitions and WebSocket progress broadcasting — identical to the inline
    FastAPI-BackgroundTask path.
    """
    from ..cv.runner import process_video

    _set_video_task_id(analysis_id, getattr(self.request, "id", None))
    process_video(analysis_id, video_path, output_dir, weights)
    return {"analysis_id": analysis_id, "ok": True}


# ── injury-model (re)training (scheduled nightly) ────────────────────────────
@celery_app.task(name="deporte.ml.train_injury_model")
def train_injury_model_task(club_id: Optional[int] = None, horizon: int = 28,
                            stride: int = 7, min_samples: int = 200,
                            min_positives: int = 25, synthetic: bool = False,
                            n_synth: int = 4000, seed: int = 42) -> dict:
    """Train / refresh the injury-risk model artifact.

    Reuses the exact trainer CLI (:func:`app.ml.injury.train.main`): it prefers
    real club history and falls back to a synthetic prior, writing the artifact
    under ``DEPORTE_MODEL_ROOT``. The serving layer hot-reloads it on the next
    request via its mtime check, so a worker on a different process still
    refreshes the API's model.
    """
    from ..ml.injury.train import main as train_main

    argv: list[str] = []
    if club_id is not None:
        argv += ["--club-id", str(club_id)]
    argv += [
        "--horizon", str(horizon), "--stride", str(stride),
        "--min-samples", str(min_samples), "--min-positives", str(min_positives),
        "--n-synth", str(n_synth), "--seed", str(seed),
    ]
    if synthetic:
        argv.append("--synthetic")

    code = train_main(argv)
    return {"ok": code == 0, "club_id": club_id, "synthetic": synthetic}


# ── external-data import (available for async re-runs) ───────────────────────
@celery_app.task(name="deporte.imports.run_job", bind=True, acks_late=True)
def run_import_job_task(self, job_id: int) -> dict:
    """(Re)run an ``ImportJob`` by id on a worker.

    Mirrors the endpoint's synchronous ``_run`` helper: ``run_import`` already
    persists ``DONE`` / ``PARTIAL`` / ``FAILED`` and the error list, so a raised
    exception just means "row already marked failed" and we roll back.
    """
    from ..core.database import SessionLocal
    from ..imports import get_importer, run_import
    from ..models.import_job import ImportJob

    db = SessionLocal()
    try:
        job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
        if not job:
            return {"job_id": job_id, "ok": False, "error": "job not found"}
        importer_cls = get_importer(job.provider, job.kind)
        if importer_cls is None:
            return {"job_id": job_id, "ok": False, "error": "unsupported provider/kind"}
        importer = importer_cls(options=job.options or {})
        try:
            run_import(db, job, importer)
        except Exception:  # noqa: BLE001 — run_import persisted FAILED already
            db.rollback()
        db.refresh(job)
        return {"job_id": job_id, "ok": job.status.value != "failed", "status": job.status.value}
    finally:
        db.close()


# ── maintenance (scheduled) ──────────────────────────────────────────────────
@celery_app.task(name="deporte.maintenance.reap_stale_analyses")
def reap_stale_analyses_task(max_age_minutes: int = 240) -> dict:
    """Fail CV analyses stuck in ``processing`` past a cutoff.

    A worker (or the old in-process BackgroundTask) that died mid-clip leaves a
    row ``processing`` forever and the UI shows a perpetual spinner. This reaps
    them so the state reflects reality.
    """
    from ..core.database import SessionLocal
    from ..models.video_analysis import CVStatus, VideoAnalysis

    cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
    db = SessionLocal()
    reaped = 0
    try:
        stale = (
            db.query(VideoAnalysis)
            .filter(
                VideoAnalysis.status == CVStatus.PROCESSING,
                VideoAnalysis.started_at.isnot(None),
                VideoAnalysis.started_at < cutoff,
            )
            .all()
        )
        for a in stale:
            a.status = CVStatus.FAILED
            a.error = f"Reaped: atascado en procesamiento más de {max_age_minutes} min"
            a.finished_at = datetime.utcnow()
            reaped += 1
        if reaped:
            db.commit()
        return {"reaped": reaped}
    finally:
        db.close()


# ── helpers ──────────────────────────────────────────────────────────────────
def _set_video_task_id(analysis_id: int, task_id: Optional[str]) -> None:
    """Persist the worker's task id on the row (best-effort) for correlation."""
    if not task_id:
        return
    from ..core.database import SessionLocal
    from ..models.video_analysis import VideoAnalysis

    db = SessionLocal()
    try:
        a = db.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id).first()
        if a is not None and a.task_id != task_id:
            a.task_id = task_id
            db.commit()
    except Exception:  # noqa: BLE001 — correlation id is non-critical
        db.rollback()
    finally:
        db.close()
