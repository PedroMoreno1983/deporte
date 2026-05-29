"""
Audit logging helpers.

Two ways to record an event:
  - `audit(db, user, action, entity, entity_id, delta=...)` — call from endpoints.
  - HTTP middleware that automatically logs non-GET requests on success.

Designed to be safe to call from sync endpoints. Uses the same DB session as
the request so it's transactional with the mutation.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import Request
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from ..models.audit import AuditLog
from ..models.user import User
from .database import SessionLocal
from .security import decode_token

log = logging.getLogger("audit")


def audit(
    db: Session,
    *,
    user: Optional[User],
    action: str,
    entity: str,
    entity_id: Optional[int] = None,
    delta: Optional[Dict[str, Any]] = None,
    note: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """Insert an audit row. Safe to call from sync request handlers."""
    try:
        entry = AuditLog(
            user_id   = user.id      if user else None,
            club_id   = user.club_id if user else None,
            action    = action,
            entity    = entity,
            entity_id = entity_id,
            delta     = delta,
            note      = note,
            path      = request.url.path  if request else None,
            method    = request.method    if request else None,
            ip_address= request.client.host if (request and request.client) else None,
            user_agent= request.headers.get("user-agent") if request else None,
        )
        db.add(entry)
        db.commit()
    except Exception as e:  # noqa: BLE001
        log.warning("audit() failed: %s", e)
        db.rollback()


# ── Middleware that captures every non-GET successful request ─────────
class AuditMiddleware(BaseHTTPMiddleware):
    """Logs an `http.<METHOD>` row for every non-GET 2xx/3xx response.

    Skips OPTIONS and the WS endpoint. Does NOT try to read the body — for a
    structured delta, call `audit()` explicitly from the endpoint.
    """
    SKIP_PATHS = {"/ws", "/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        method = request.method.upper()
        path = request.url.path

        response: Response = await call_next(request)

        if (
            method in ("GET", "OPTIONS")
            or path in self.SKIP_PATHS
            or path.startswith("/docs")
            or path.startswith("/redoc")
            or response.status_code >= 400
        ):
            return response

        # Resolve current user from bearer token (best-effort, no exception leaks)
        user: Optional[User] = None
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            payload = decode_token(auth[7:])
            if payload and payload.get("type") == "access":
                sub = payload.get("sub")
                if sub is not None:
                    db = SessionLocal()
                    try:
                        user = db.query(User).filter(User.id == int(sub)).first()
                    finally:
                        db.close()

        db = SessionLocal()
        try:
            audit(
                db,
                user=user,
                action=f"http.{method.lower()}",
                entity="http",
                request=request,
            )
        finally:
            db.close()

        return response
