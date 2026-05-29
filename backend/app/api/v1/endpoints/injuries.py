from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ....core.database import get_db
from ....core.deps import get_current_user, require_roles, scoped_query
from ....models.injury import Injury
from ....models.player import Player, PlayerStatus
from ....models.user import UserRole, User
from ....schemas.injury import InjuryCreate, InjuryUpdate, InjuryOut
from ....websockets import manager, RealtimeEvent

router = APIRouter()


@router.get("/player/{player_id}", response_model=List[InjuryOut])
def get_player_injuries(
    player_id: int, skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the player belongs to current club
    player_q = scoped_query(db.query(Player).filter(Player.id == player_id), Player, current_user)
    if not player_q.first():
        return []
    return (
        db.query(Injury)
        .filter(Injury.player_id == player_id)
        .order_by(Injury.injury_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/active", response_model=List[InjuryOut])
def get_active_injuries(
    skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Scope via player join
    q = db.query(Injury).join(Player, Injury.player_id == Player.id).filter(Injury.is_recovered == False)
    q = scoped_query(q, Player, current_user)
    return q.order_by(Injury.injury_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=InjuryOut, status_code=status.HTTP_201_CREATED)
def create_injury(
    data: InjuryCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.KINESIOLOGIST, UserRole.COACH)),
):
    injury = Injury(**data.model_dump())
    db.add(injury)
    # Update player status
    player = db.query(Player).filter(Player.id == data.player_id).first()
    if player:
        player.status = PlayerStatus.INJURED
    db.commit()
    db.refresh(injury)

    # Broadcast: team-wide injury alert
    manager.publish_sync(RealtimeEvent(
        topic="injuries",
        type="injury.created",
        payload={
            "injury_id":  injury.id,
            "player_id":  injury.player_id,
            "player_name": player.full_name if player else None,
            "severity":   getattr(injury.severity, "value", str(injury.severity)),
            "injury_type": injury.injury_type,
            "injury_date": str(injury.injury_date),
        },
    ))
    # Also surface as notification
    manager.publish_sync(RealtimeEvent(
        topic="notifications",
        type="notification.new",
        payload={"kind": "lesion_activa", "player_id": injury.player_id},
    ))
    return injury


@router.patch("/{injury_id}", response_model=InjuryOut)
def update_injury(
    injury_id: int,
    data: InjuryUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.KINESIOLOGIST)),
):
    injury = db.query(Injury).filter(Injury.id == injury_id).first()
    if not injury:
        raise HTTPException(status_code=404, detail="Lesión no encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(injury, field, value)
    # If recovered, update player status
    if data.is_recovered:
        player = db.query(Player).filter(Player.id == injury.player_id).first()
        if player:
            player.status = PlayerStatus.AVAILABLE
    db.commit()
    db.refresh(injury)

    manager.publish_sync(RealtimeEvent(
        topic="injuries",
        type="injury.updated",
        payload={
            "injury_id":   injury.id,
            "player_id":   injury.player_id,
            "is_recovered": bool(injury.is_recovered),
        },
    ))
    return injury
