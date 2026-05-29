"""
In-memory WebSocket connection manager.
- Connections are keyed by user_id (one user can have multiple sockets — tabs, mobile).
- Messages are broadcast by topic. A connection subscribes to N topics on connect.
- Broadcast helpers are awaitable but safe to call from sync DB endpoints via a
  fire-and-forget bridge (see `publish_sync`).

This is in-process pub/sub. For multi-instance deployments swap to Redis
(`aioredis.client.PubSub`) without touching call sites — same `publish` API.
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, Optional, Set

from fastapi import WebSocket

log = logging.getLogger("ws.manager")


# ── Event payload ─────────────────────────────────────────────────────
@dataclass
class RealtimeEvent:
    topic: str
    type: str                  # e.g. "injury.created", "wellness.updated"
    payload: Dict[str, Any] = field(default_factory=dict)
    ts: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    def to_json(self) -> str:
        return json.dumps({
            "topic":   self.topic,
            "type":    self.type,
            "payload": self.payload,
            "ts":      self.ts,
        })


# ── Connection record ─────────────────────────────────────────────────
@dataclass
class Connection:
    ws: WebSocket
    user_id: int
    topics: Set[str] = field(default_factory=set)


class ConnectionManager:
    """Single global manager. Thread-unsafe by design (asyncio single-threaded)."""

    def __init__(self) -> None:
        # user_id -> set of connections
        self._by_user: Dict[int, Set[Connection]] = {}
        # topic -> set of connections
        self._by_topic: Dict[str, Set[Connection]] = {}

    # ── Lifecycle ───────────────────────────────────────────────────
    async def connect(self, ws: WebSocket, user_id: int, topics: Iterable[str]) -> Connection:
        await ws.accept()
        conn = Connection(ws=ws, user_id=user_id, topics=set(topics))
        self._by_user.setdefault(user_id, set()).add(conn)
        for t in conn.topics:
            self._by_topic.setdefault(t, set()).add(conn)
        log.info("WS connect user=%s topics=%s (total=%d)", user_id, conn.topics, self._count())
        return conn

    async def disconnect(self, conn: Connection) -> None:
        users = self._by_user.get(conn.user_id)
        if users:
            users.discard(conn)
            if not users:
                self._by_user.pop(conn.user_id, None)
        for t in conn.topics:
            subs = self._by_topic.get(t)
            if subs:
                subs.discard(conn)
                if not subs:
                    self._by_topic.pop(t, None)
        log.info("WS disconnect user=%s (total=%d)", conn.user_id, self._count())

    def _count(self) -> int:
        return sum(len(v) for v in self._by_user.values())

    # ── Publish ─────────────────────────────────────────────────────
    async def publish(self, event: RealtimeEvent, *, user_id: Optional[int] = None) -> int:
        """Broadcast `event` to every subscriber of `event.topic`.
        If `user_id` is given, restrict to that user's connections (private event)."""
        body = event.to_json()
        targets: Set[Connection]
        if user_id is not None:
            user_conns = self._by_user.get(user_id, set())
            topic_conns = self._by_topic.get(event.topic, set())
            targets = user_conns & topic_conns
        else:
            targets = set(self._by_topic.get(event.topic, ()))

        delivered = 0
        for conn in list(targets):
            try:
                await conn.ws.send_text(body)
                delivered += 1
            except Exception:  # noqa: BLE001
                # Connection dropped mid-send; clean up
                await self.disconnect(conn)
        return delivered

    def publish_sync(self, event: RealtimeEvent, *, user_id: Optional[int] = None) -> None:
        """Fire-and-forget bridge for use inside sync request handlers.
        Schedules the broadcast on the running event loop without blocking."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No event loop in this context — drop silently (or log).
            log.debug("publish_sync without running loop, dropping event=%s", event.type)
            return
        loop.create_task(self.publish(event, user_id=user_id))


# Global singleton
manager = ConnectionManager()
