from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Text
from sqlalchemy.sql import func
from ..core.database import Base


class AuditLog(Base):
    """Append-only audit trail of mutations across the platform.

    Records:
      - who    (user_id + club_id)
      - what   (action verb + entity name + entity id)
      - when   (created_at server default)
      - where  (HTTP path + method)
      - delta  (JSON of changes — optional)
    """
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    club_id     = Column(Integer, ForeignKey("clubs.id"), nullable=True, index=True)
    action      = Column(String, nullable=False, index=True)   # e.g. "player.update"
    entity      = Column(String, nullable=False, index=True)   # e.g. "Player"
    entity_id   = Column(Integer, nullable=True, index=True)
    path        = Column(String, nullable=True)
    method      = Column(String, nullable=True)
    delta       = Column(JSON,   nullable=True)
    note        = Column(Text,   nullable=True)
    ip_address  = Column(String, nullable=True)
    user_agent  = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)
