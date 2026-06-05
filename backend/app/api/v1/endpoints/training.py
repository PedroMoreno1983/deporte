from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from ....core.database import get_db
from ....core.deps import get_current_user, require_roles, scoped_query, get_player_in_club
from ....models.training import TrainingSession
from ....models.user import User, UserRole
from ....schemas.training import TrainingSessionCreate, TrainingSessionOut

router = APIRouter()


def calculate_acwr(player_id: int, session_date: date, db: Session) -> dict:
    """Calculate Acute (7d) and Chronic (28d) workload and ACWR."""
    cutoff_28 = session_date - timedelta(days=28)
    cutoff_7 = session_date - timedelta(days=7)

    sessions_28 = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.player_id == player_id,
            TrainingSession.session_date >= cutoff_28,
            TrainingSession.session_date < session_date,
            TrainingSession.session_load.isnot(None),
        )
        .all()
    )

    loads_28 = [s.session_load for s in sessions_28 if s.session_load]
    loads_7 = [s.session_load for s in sessions_28 if s.session_load and s.session_date >= cutoff_7]

    chronic = sum(loads_28) / 28 if loads_28 else 0
    acute = sum(loads_7) / 7 if loads_7 else 0
    acwr = round(acute / chronic, 3) if chronic > 0 else None

    return {"acute_load": round(acute, 2), "chronic_load": round(chronic, 2), "acwr": acwr}


@router.get("/player/{player_id}", response_model=List[TrainingSessionOut])
def get_player_sessions(
    player_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _player=Depends(get_player_in_club),
):
    q = db.query(TrainingSession).filter(TrainingSession.player_id == player_id)
    if start_date:
        q = q.filter(TrainingSession.session_date >= start_date)
    if end_date:
        q = q.filter(TrainingSession.session_date <= end_date)
    return q.order_by(TrainingSession.session_date.desc()).all()


@router.get("/team", response_model=List[TrainingSessionOut])
def get_team_sessions(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All sessions in a date range — for calendar view (current club only)."""
    q = scoped_query(db.query(TrainingSession), TrainingSession, current_user)
    if start_date:
        q = q.filter(TrainingSession.session_date >= start_date)
    if end_date:
        q = q.filter(TrainingSession.session_date <= end_date)
    return q.order_by(TrainingSession.session_date.desc()).all()


@router.post("/", response_model=TrainingSessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    data: TrainingSessionCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.KINESIOLOGIST)),
):
    payload = data.model_dump()

    # Calcular carga de sesión (RPE × duración)
    if payload.get("rpe") and payload.get("duration_minutes"):
        payload["session_load"] = payload["rpe"] * payload["duration_minutes"]

    # Calcular ACWR
    acwr_data = calculate_acwr(data.player_id, data.session_date, db)
    payload.update(acwr_data)

    session = TrainingSession(**payload)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
