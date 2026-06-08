"""Celery application — async task queue backed by Redis.

Carries the heavy / slow / scheduled work that must not block an HTTP request
(nor a request's in-process ``BackgroundTask`` thread):

* **CV video analysis** — minutes per clip, CPU/GPU bound (the flagship task).
* **Injury-model (re)training** — scheduled nightly, CPU bound.
* **Maintenance** — reaping CV jobs stuck in ``processing``.

Design choices
--------------
* Broker **and** result backend are the same Redis (``settings.REDIS_URL``).
  One dependency, fine for a single-club deployment; the backend can move to a
  DB / RabbitMQ later without touching any task code.
* The API never *requires* a broker. :mod:`app.worker.dispatch` transparently
  falls back to inline / FastAPI-BackgroundTask execution when Redis is
  unreachable, so dev boxes and CI keep working with no worker process.
* ``task_acks_late`` + ``task_reject_on_worker_lost`` + ``prefetch=1`` make the
  long CV task crash-safe and fairly dispatched: a worker dying mid-clip
  redelivers the job rather than dropping it. The trade-off is a "poison-pill"
  clip that reliably crashes a worker could redeliver in a loop — the hourly
  reaper (and an eventual dead-letter policy) is the backstop for that.

Run a worker (all queues)::

    celery -A app.worker.celery_app:celery_app worker \\
        -Q cv,ml,imports,maintenance,default --concurrency 2 --loglevel info

Run the scheduler (for the nightly retrain / hourly reaper)::

    celery -A app.worker.celery_app:celery_app beat --loglevel info
"""
from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

from ..core.config import settings

celery_app = Celery("deporte")

celery_app.conf.update(
    broker_url=settings.REDIS_URL,
    result_backend=settings.REDIS_URL,
    # ── serialization ────────────────────────────────────────────────────
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # ── reliability for long-running tasks ───────────────────────────────
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,        # fair dispatch: don't hoard long jobs
    task_track_started=True,             # expose a STARTED state to pollers
    result_expires=24 * 3600,            # forget results after a day
    broker_connection_retry_on_startup=True,
    # Redis-specific: a CV clip can run for a long time; don't let the broker
    # consider the message lost and redeliver it before the task can finish.
    broker_transport_options={"visibility_timeout": 6 * 3600},
    # ── routing ──────────────────────────────────────────────────────────
    task_default_queue="default",
    task_routes={
        "deporte.cv.*": {"queue": "cv"},
        "deporte.ml.*": {"queue": "ml"},
        "deporte.imports.*": {"queue": "imports"},
        "deporte.maintenance.*": {"queue": "maintenance"},
        "deporte.agent.*": {"queue": "maintenance"},
    },
    # Global ceilings; the CV task overrides these with a much larger limit.
    task_soft_time_limit=30 * 60,
    task_time_limit=35 * 60,
    # ── periodic schedule (consumed by `celery beat`) ────────────────────
    beat_schedule={
        "retrain-injury-model-nightly": {
            "task": "deporte.ml.train_injury_model",
            "schedule": crontab(hour=3, minute=30),
            "kwargs": {"min_samples": 200, "min_positives": 25},
            "options": {"queue": "ml"},
        },
        "reap-stale-analyses-hourly": {
            "task": "deporte.maintenance.reap_stale_analyses",
            "schedule": crontab(minute=15),
            "options": {"queue": "maintenance"},
        },
        "agent-daily-briefing": {
            "task": "deporte.agent.daily_briefing",
            "schedule": crontab(hour=7, minute=0),   # cada mañana
            "options": {"queue": "maintenance"},
        },
    },
)

# Opt-in eager mode for local runs without a broker. Tests flip this on a
# per-session basis via a fixture (so it works regardless of import order).
if os.getenv("CELERY_TASK_ALWAYS_EAGER", "").lower() in {"1", "true", "yes"}:
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True

# Import side-effect: registers every @celery_app.task in this package. Kept at
# the bottom so `celery_app` is fully defined before tasks import it back.
from . import tasks  # noqa: E402,F401
