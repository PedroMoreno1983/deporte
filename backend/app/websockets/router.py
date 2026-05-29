"""
WebSocket router.

Single endpoint `/ws` that authenticates via `?token=<jwt>` and accepts a
`topics` query param (csv) for the subscription set. Default topics if omitted:
  notifications, wellness, team, injuries

Why a single endpoint and not one per topic: simpler client (one socket per
session), fewer connections, easier auth, and the manager already routes by
topic.

Protocol:
  Server → Client: text JSON
    { "topic": str, "type": str, "payload": object, "ts": iso8601 }
  Client → Server: text JSON (currently only `ping`)
    { "type": "ping" }   → server replies { "type": "pong" }
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..core.database import SessionLocal
from ..core.security import decode_token
from ..models.user import User
from .manager import manager

log = logging.getLogger("ws.router")
ws_router = APIRouter()

DEFAULT_TOPICS = {"notifications", "wellness", "team", "injuries", "cv"}
ALLOWED_TOPICS = DEFAULT_TOPICS  # extend as features arrive


def _resolve_user(token: str) -> Optional[User]:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    db: Session = SessionLocal()
    try:
        return db.query(User).filter(User.id == int(user_id), User.is_active.is_(True)).first()
    finally:
        db.close()


@ws_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
    topics: str = Query("", description="Comma-separated topics to subscribe to"),
):
    user = _resolve_user(token)
    if not user:
        await websocket.close(code=4401)  # custom: unauthorized
        return

    requested = {t.strip() for t in topics.split(",") if t.strip()}
    sub_topics = (requested & ALLOWED_TOPICS) or DEFAULT_TOPICS

    conn = await manager.connect(websocket, user_id=user.id, topics=sub_topics)

    # Greet client so it knows the socket is alive and what it's subscribed to
    try:
        await websocket.send_text(json.dumps({
            "topic": "system",
            "type": "connected",
            "payload": {
                "user_id": user.id,
                "topics":  sorted(sub_topics),
            },
        }))

        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        log.warning("WS error user=%s: %s", user.id, e)
    finally:
        await manager.disconnect(conn)
