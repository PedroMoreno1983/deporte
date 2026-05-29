"""WebSocket support: connection manager + router + broadcast helpers."""
from .manager import manager, RealtimeEvent
from .router import ws_router

__all__ = ["manager", "RealtimeEvent", "ws_router"]
