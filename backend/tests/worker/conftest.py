"""Fixtures for the async-queue (Celery) tests.

The tasks open their own ``SessionLocal()`` internally (they don't take an
injected session), so ``patched_db`` swaps ``app.core.database.SessionLocal``
for an in-memory engine — the tasks' in-function ``from ..core.database import
SessionLocal`` then resolves to the patched object at call time.

``eager`` flips Celery into in-process execution; ``no_broker`` forces the
non-eager + unreachable-broker path so the dispatcher's fallback is exercised.
All three snapshot and restore global Celery/dispatch state so tests don't leak.
"""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registers every table on Base.metadata
from app.core.database import Base
from app.worker.celery_app import celery_app
from app.worker.dispatch import reset_broker_cache


@pytest.fixture()
def patched_db(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    # Tasks do `from ..core.database import SessionLocal` at call time, so
    # patching the module attribute is enough.
    monkeypatch.setattr("app.core.database.SessionLocal", TestSession)
    try:
        yield TestSession
    finally:
        engine.dispose()


@pytest.fixture()
def eager():
    prev_eager = celery_app.conf.task_always_eager
    prev_prop = celery_app.conf.task_eager_propagates
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    reset_broker_cache()
    try:
        yield
    finally:
        celery_app.conf.task_always_eager = prev_eager
        celery_app.conf.task_eager_propagates = prev_prop
        reset_broker_cache()


@pytest.fixture()
def no_broker(monkeypatch):
    prev_eager = celery_app.conf.task_always_eager
    celery_app.conf.task_always_eager = False
    # enqueue()/dispatch_video_analysis() look up broker_available as a module
    # global, so patching the attribute redirects them.
    monkeypatch.setattr("app.worker.dispatch.broker_available", lambda *a, **k: False)
    reset_broker_cache()
    try:
        yield
    finally:
        celery_app.conf.task_always_eager = prev_eager
        reset_broker_cache()
