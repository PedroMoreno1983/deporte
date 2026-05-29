"""Async-task introspection endpoints.

GET /tasks/health        broker reachability + execution mode (eager/queued)
GET /tasks/{task_id}     poll a Celery task's state and result

Used by the frontend to follow long jobs (CV analysis above all) and by ops to
confirm the queue is live. Authenticated; task ids are opaque UUIDs so there is
no cross-tenant enumeration surface.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ....core.deps import get_current_user
from ....models.user import User

router = APIRouter()


@router.get("/health")
def tasks_health(_user: User = Depends(get_current_user)):
    """Broker reachability and current execution mode."""
    from ....worker.dispatch import broker_health

    return broker_health()


@router.get("/{task_id}")
def get_task(task_id: str, _user: User = Depends(get_current_user)):
    """Poll a queued task's state/result by its Celery id."""
    from ....worker.dispatch import task_status

    return task_status(task_id)
