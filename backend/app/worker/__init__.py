"""Async task queue (Celery + Redis).

Importing this package registers the Celery app and all task definitions.
``celery`` is aliased to the app instance so ``celery -A app.worker worker``
resolves it without the explicit ``:celery_app`` suffix.
"""
from .celery_app import celery_app
from .dispatch import (
    broker_available,
    broker_health,
    dispatch_video_analysis,
    enqueue,
    reset_broker_cache,
    task_status,
)

# Celery's `-A app.worker` probe looks for an attribute named `celery` or `app`.
celery = celery_app

__all__ = [
    "celery_app",
    "celery",
    "enqueue",
    "broker_available",
    "reset_broker_cache",
    "dispatch_video_analysis",
    "task_status",
    "broker_health",
]
