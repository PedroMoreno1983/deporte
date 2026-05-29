"""Async-queue behaviour: config sanity, task registration, graceful fallback,
and the real task bodies actually doing their work (not stubs).

Nothing here needs a running Redis: eager mode runs tasks in-process and the
no-broker fixture forces the fallback path deterministically.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.core.config import settings
from app.worker.celery_app import celery_app
from app.worker.dispatch import (
    broker_available,
    broker_health,
    dispatch_video_analysis,
    enqueue,
    reset_broker_cache,
    task_status,
)
from app.worker.tasks import (
    analyze_video_task,
    reap_stale_analyses_task,
    run_import_job_task,
    train_injury_model_task,
)
from app.models.video_analysis import CVStatus, VideoAnalysis


# ── configuration ────────────────────────────────────────────────────────────
def test_celery_is_configured_for_production():
    c = celery_app.conf
    assert c.broker_url == settings.REDIS_URL
    assert c.result_backend == settings.REDIS_URL
    assert c.task_serializer == "json"
    assert "json" in c.accept_content
    assert c.timezone == "UTC"
    # Long-task reliability knobs.
    assert c.task_acks_late is True
    assert c.task_reject_on_worker_lost is True
    assert c.worker_prefetch_multiplier == 1
    assert c.task_track_started is True


def test_task_routing_and_schedule():
    routes = celery_app.conf.task_routes
    assert routes["deporte.cv.*"]["queue"] == "cv"
    assert routes["deporte.ml.*"]["queue"] == "ml"
    assert routes["deporte.imports.*"]["queue"] == "imports"
    assert routes["deporte.maintenance.*"]["queue"] == "maintenance"

    sched = celery_app.conf.beat_schedule
    assert sched["retrain-injury-model-nightly"]["task"] == "deporte.ml.train_injury_model"
    assert sched["reap-stale-analyses-hourly"]["task"] == "deporte.maintenance.reap_stale_analyses"


def test_all_tasks_registered():
    for name in (
        "deporte.cv.analyze_video",
        "deporte.ml.train_injury_model",
        "deporte.imports.run_job",
        "deporte.maintenance.reap_stale_analyses",
    ):
        assert name in celery_app.tasks


# ── dispatcher: broker probing + fallback ────────────────────────────────────
def test_broker_available_true_in_eager_mode(eager):
    assert broker_available() is True


def test_broker_available_false_when_connection_raises(monkeypatch):
    celery_app.conf.task_always_eager = False
    reset_broker_cache()

    def boom():
        raise OSError("no redis")

    monkeypatch.setattr(celery_app, "connection", boom)
    try:
        assert broker_available() is False
    finally:
        reset_broker_cache()


def test_enqueue_runs_fallback_when_no_broker(no_broker):
    calls = []
    result = enqueue(reap_stale_analyses_task, fallback=lambda: calls.append("ran"))
    assert result is None          # ran via fallback, not queued
    assert calls == ["ran"]        # the fallback fired


def test_enqueue_runs_task_eagerly(eager, patched_db):
    # Seed a stale PROCESSING row; eager enqueue must actually execute the task.
    s = patched_db()
    s.add(VideoAnalysis(
        name="old", video_path="/x.mp4", club_id=1,
        status=CVStatus.PROCESSING, progress=0.5,
        started_at=datetime.utcnow() - timedelta(hours=5),
    ))
    s.commit()
    s.close()

    task_id = enqueue(reap_stale_analyses_task, max_age_minutes=240)
    assert task_id  # EagerResult still carries an id

    check = patched_db()
    row = check.query(VideoAnalysis).first()
    assert row.status == CVStatus.FAILED   # proves the task ran in-process
    check.close()


def test_dispatch_video_falls_back_to_background_task(no_broker):
    captured = {}

    class FakeBackground:
        def add_task(self, fn, *args):
            captured["fn"] = fn
            captured["args"] = args

    out = dispatch_video_analysis(
        7, "/v.mp4", "/out", background=FakeBackground()
    )
    assert out == {"mode": "background", "task_id": None}
    # Scheduled the real pipeline entry point with the right args (not invoked).
    assert captured["fn"].__name__ == "process_video"
    assert captured["args"] == (7, "/v.mp4", "/out", None)


# ── real task bodies ─────────────────────────────────────────────────────────
def test_reap_only_fails_old_processing_rows(patched_db):
    now = datetime.utcnow()
    s = patched_db()
    s.add_all([
        VideoAnalysis(name="stale", video_path="/a", club_id=1,
                      status=CVStatus.PROCESSING, started_at=now - timedelta(hours=5)),
        VideoAnalysis(name="fresh", video_path="/b", club_id=1,
                      status=CVStatus.PROCESSING, started_at=now - timedelta(minutes=10)),
        VideoAnalysis(name="done", video_path="/c", club_id=1,
                      status=CVStatus.DONE, started_at=now - timedelta(hours=9)),
        VideoAnalysis(name="nostart", video_path="/d", club_id=1,
                      status=CVStatus.PROCESSING, started_at=None),
    ])
    s.commit()
    s.close()

    result = reap_stale_analyses_task(max_age_minutes=240)
    assert result == {"reaped": 1}

    check = patched_db()
    by_name = {r.name: r for r in check.query(VideoAnalysis).all()}
    assert by_name["stale"].status == CVStatus.FAILED
    assert by_name["stale"].error and by_name["stale"].finished_at is not None
    assert by_name["fresh"].status == CVStatus.PROCESSING
    assert by_name["done"].status == CVStatus.DONE
    assert by_name["nostart"].status == CVStatus.PROCESSING
    check.close()


def test_import_task_reports_missing_job(patched_db):
    # No ImportJob rows: the task should report cleanly, not raise.
    out = run_import_job_task(12345)
    assert out["ok"] is False
    assert "not found" in out["error"]


def test_train_task_trains_and_writes_a_model(tmp_path, monkeypatch):
    pytest.importorskip("xgboost")
    monkeypatch.setenv("DEPORTE_MODEL_ROOT", str(tmp_path / "ml_models"))
    # Synthetic path doesn't touch the DB, but main() reconciles schema first;
    # stub that so the test stays fully isolated from any real ./deporte.db.
    monkeypatch.setattr("app.ml.injury.train.ensure_schema", lambda: None)

    out = train_injury_model_task(synthetic=True, n_synth=800, seed=1)
    assert out["ok"] is True

    from app.ml.injury.model import default_model_dir

    artifacts = list(default_model_dir().glob("*.ubj"))
    assert artifacts, "trainer task did not persist a model artifact"


# ── introspection ────────────────────────────────────────────────────────────
def test_broker_health_shape(eager):
    health = broker_health()
    assert health["broker"] == "up"     # eager ⇒ reported up
    assert health["eager"] is True
    assert health["backend"] == "redis"


def test_task_status_unknown_id_is_safe():
    # An id that was never queued must return a benign payload, never raise.
    status = task_status("does-not-exist-0000")
    assert status["task_id"] == "does-not-exist-0000"
    assert "state" in status
