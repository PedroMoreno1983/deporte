from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ....core.database import get_db
from ....core.deps import scoped_query
from ....core.permissions import require_permission
from ....models.audit import AuditLog
from ....models.user import User

router = APIRouter()


@router.get("/")
def list_audit(
    skip: int = 0,
    limit: int = Query(100, le=500),
    action: Optional[str] = None,
    entity: Optional[str] = None,
    user_id: Optional[int] = None,
    since: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
) -> List[Dict[str, Any]]:
    q = db.query(AuditLog)
    q = scoped_query(q, AuditLog, current_user)
    if action:  q = q.filter(AuditLog.action == action)
    if entity:  q = q.filter(AuditLog.entity == entity)
    if user_id: q = q.filter(AuditLog.user_id == user_id)
    if since:   q = q.filter(AuditLog.created_at >= since)
    rows = q.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()
    return [
        {
            "id":         r.id,
            "user_id":    r.user_id,
            "club_id":    r.club_id,
            "action":     r.action,
            "entity":     r.entity,
            "entity_id":  r.entity_id,
            "path":       r.path,
            "method":     r.method,
            "delta":      r.delta,
            "note":       r.note,
            "ip_address": r.ip_address,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
