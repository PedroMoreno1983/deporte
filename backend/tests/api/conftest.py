"""HTTP-level fixtures: an isolated in-memory DB behind a real TestClient.

Mirrors the worker tests' StaticPool pattern. ``get_db`` is overridden so every
request hits the throwaway SQLite DB, and the audit middleware's own
``SessionLocal`` is repointed there too so nothing leaks into the dev DB.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registers every table on Base.metadata
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.user import User, UserRole


@pytest.fixture()
def db_session(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    # AuditMiddleware opens its own SessionLocal() — point it at the test DB.
    monkeypatch.setattr("app.core.audit.SessionLocal", TestSession)
    try:
        yield TestSession
    finally:
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        db = db_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def make_user(db_session):
    """Insert a user and return it. Password defaults to a known value."""
    def _make(
        email: str = "coach@club.cl",
        password: str = "Secret123!",
        role: UserRole = UserRole.COACH,
        full_name: str = "Test User",
        **kw,
    ) -> User:
        db = db_session()
        try:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=get_password_hash(password),
                role=role,
                is_active=True,
                **kw,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()

    return _make
