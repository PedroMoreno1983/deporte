from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from ....core.database import get_db
from ....core.deps import get_current_user, require_roles
from ....models.player import Player, PlayerStatus
from ....models.user import UserRole
from ....schemas.player import PlayerCreate, PlayerUpdate, PlayerOut, PlayerSummary

router = APIRouter()


@router.get("/", response_model=List[PlayerSummary])
def list_players(
    category_id: Optional[int] = None,
    status: Optional[PlayerStatus] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Player).filter(Player.is_active == True)
    if category_id:
        q = q.filter(Player.category_id == category_id)
    if status:
        q = q.filter(Player.status == status)
    if search:
        q = q.filter(
            (Player.first_name.ilike(f"%{search}%")) | (Player.last_name.ilike(f"%{search}%"))
        )
    return q.order_by(Player.last_name).all()


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    player = db.query(Player).options(joinedload(Player.category)).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    return player


@router.post("/", response_model=PlayerOut, status_code=status.HTTP_201_CREATED)
def create_player(
    data: PlayerCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH)),
):
    player = Player(**data.model_dump())
    db.add(player)
    db.commit()
    db.refresh(player)
    return db.query(Player).options(joinedload(Player.category)).filter(Player.id == player.id).first()


@router.patch("/{player_id}", response_model=PlayerOut)
def update_player(
    player_id: int,
    data: PlayerUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.KINESIOLOGIST)),
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return db.query(Player).options(joinedload(Player.category)).filter(Player.id == player_id).first()


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN)),
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    player.is_active = False
    db.commit()
