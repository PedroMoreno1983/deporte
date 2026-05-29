"""Dispatch + introspection helpers for the Celery queue.

The point of this module is graceful degradation: enqueue on Celery **when a
broker is reachable**, otherwise run the work inline / as a FastAPI
BackgroundTask. That is what lets the API behave identically with **no** Redis
or worker running (dev boxes, CI, the test-suite) while transparently using the
async queue in production.
"""
from __future__ import annotations

import logging
import time
from typing import Callable, Optional

from .celery_app import celery_app

log = logging.getLogger("worker.dispatch")

# Tiny TTL cache so we probe Redis at most once every few seconds rather than on
# every request — a failed probe is cheap but not free.
_BROKER_CACHE = {"ok": False, "checked_at": 0.0}
_BROKER_TTL_S = 5.0


def broker_available(timeout: float = 0.5) -> bool:
    """Best-effort, cached check that the Celery broker accepts a connection."""
    if celery_app.conf.task_always_eager:
        return True
    now = time.monotonic()
    if now - _BROKER_CACHE["checked_at"] < _BROKER_TTL_S:
        return bool(_BROKER_CACHE["ok"])
    ok = False
    try:
        conn = celery_app.connection()
        try:
            conn.ensure_connection(max_retries=0, timeout=timeout)
            ok = True
        finally:
            conn.release()
    except Exception as exc:  # noqa: BLE001 — any failure means "use the fallback"
        log.debug("Broker not available: %s", exc)
        ok = False
    _BROKER_CACHE.update(ok=ok, checked_at=now)
    return ok


def reset_broker_cache() -> None:
    """Drop the cached probe result (tests / after a known topology change)."""
    _BROKER_CACHE.update(ok=False, checked_at=0.0)


def enqueue(task, *args, queue: Optional[str] = None,
            fallback: Optional[Callable[[], None]] = None, **kwargs) -> Optional[str]:
    """Enqueue ``task`` on Celery, else run ``fallback`` (or the task) inline.

    Returns the Celery task id when queued (incl. the EagerResult id under
    ``task_always_eager``), or ``None`` when it ran via the fallback.
    """
    if celery_app.conf.task_always_eager:
        return getattr(task.apply(args=args, kwargs=kwargs), "id", None)
    if broker_available():
        try:
            opts = {"queue": queue} if queue else {}
            return task.apply_async(args=args, kwargs=kwargs, **opts).id
        except Exception as exc:  # noqa: BLE001 — broker hiccup between probe & publish
            log.warning("Enqueue of %s failed (%s); falling back", task.name, exc)
    if fallback is not None:
        fallback()
        return None
    # No fallback and no broker: run synchronously as a last resort so the
    # request still gets the work done rather than silently dropping it.
    task.apply(args=args, kwargs=kwargs)
    return None


def dispatch_video_analysis(analysis_id: int, video_path: str, output_dir: str, *,
                            weights: Optional[str] = None, background=None) -> dict:
    """CV upload dispatch: prefer Celery, fall back to a FastAPI BackgroundTask.

    Returns ``{"mode": "celery"|"background"|"inline", "task_id": str|None}`` so
    the endpoint can record the task id on the row for later polling.
    """
    from .tasks import analyze_video_task

    if not celery_app.conf.task_always_eager and broker_available():
        try:
            res = analyze_video_task.apply_async(
                args=[analysis_id, video_path, output_dir, weights], queue="cv"
            )
            return {"mode": "celery", "task_id": res.id}
        except Exception as exc:  # noqa: BLE001
            log.warning("CV enqueue failed (%s); using in-process background task", exc)

    if background is not None:
        # Exactly the pre-Celery behaviour: run after the response is sent.
        from ..cv.runner import process_video

        background.add_task(process_video, analysis_id, video_path, output_dir, weights)
        return {"mode": "background", "task_id": None}

    # Eager mode (tests) or no background object available: run synchronously.
    res = analyze_video_task.apply(args=[analysis_id, video_path, output_dir, weights])
    return {"mode": "inline", "task_id": getattr(res, "id", None)}


# ── introspection (powers the /tasks endpoints) ──────────────────────────────
def task_status(task_id: str) -> dict:
    """Poll a task's state/result via the result backend (degrades if down)."""
    out: dict = {"task_id": task_id, "state": "UNKNOWN", "ready": False}
    try:
        res = celery_app.AsyncResult(task_id)
        out["state"] = res.state
        out["ready"] = res.ready()
        if out["ready"]:
            out["successful"] = res.successful()
            if res.successful():
                out["result"] = res.result
            else:
                out["error"] = str(res.result) if res.result else None
    except Exception as exc:  # noqa: BLE001 — backend unreachable
        log.debug("task_status(%s) failed: %s", task_id, exc)
        out["error"] = "result backend unavailable"
    return out


def broker_health() -> dict:
    """Shape consumed by ``GET /tasks/health``."""
    return {
        "broker": "up" if broker_available() else "down",
        "eager": bool(celery_app.conf.task_always_eager),
        "backend": "redis",
    }
