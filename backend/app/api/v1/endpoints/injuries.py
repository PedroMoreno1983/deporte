from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ....core.database import get_db
from ....core.deps import get_current_user, require_roles
from ....models.injury import Injury
from ....models.player import Player, PlayerStatus
from ....models.user import UserRole
from ....schemas.injury import InjuryCreate, InjuryUpdate, InjuryOut

router = APIRouter()


@router.get("/player/{player_id}", response_model=List[InjuryOut])
def get_player_injuries(player_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(Injury)
        .filter(Injury.player_id == player_id)
        .order_by(Injury.injury_date.desc())
        .all()
    )


@router.get("/active", response_model=List[InjuryOut])
def get_active_injuries(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Injury).filter(Injury.is_recovered == False).order_by(Injury.injury_date.desc()).all()


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
    return injury
