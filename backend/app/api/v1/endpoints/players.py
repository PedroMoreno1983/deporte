from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
import base64
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from ....core.database import get_db
from ....core.deps import get_current_user, require_roles, get_current_club_id, scoped_query
from ....models.player import Player, PlayerStatus
from ....models.category import Category
from ....models.user import UserRole, User
from ....schemas.player import PlayerCreate, PlayerUpdate, PlayerOut, PlayerSummary

router = APIRouter()


@router.get("/", response_model=List[PlayerSummary])
def list_players(
    category_id: Optional[int] = None,
    status: Optional[PlayerStatus] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Player).filter(Player.is_active == True)
    q = scoped_query(q, Player, current_user)
    if category_id:
        q = q.filter(Player.category_id == category_id)
    if status:
        q = q.filter(Player.status == status)
    if search:
        q = q.filter(
            (Player.first_name.ilike(f"%{search}%")) | (Player.last_name.ilike(f"%{search}%"))
        )
    return q.order_by(Player.last_name).offset(skip).limit(limit).all()


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Player).options(joinedload(Player.category)).filter(Player.id == player_id)
    q = scoped_query(q, Player, current_user)
    player = q.first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    return player


@router.post("/", response_model=PlayerOut, status_code=status.HTTP_201_CREATED)
def create_player(
    data: PlayerCreate,
    db: Session = Depends(get_db),
    club_id: int = Depends(get_current_club_id),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH)),
):
    # Verify category belongs to current club
    cat = db.query(Category).filter(Category.id == data.category_id, Category.club_id == club_id).first()
    if not cat:
        raise HTTPException(status_code=400, detail="Categoría inválida para este club")
    payload = data.model_dump()
    payload["club_id"] = club_id
    player = Player(**payload)
    db.add(player)
    db.commit()
    db.refresh(player)
    return db.query(Player).options(joinedload(Player.category)).filter(Player.id == player.id).first()


@router.patch("/{player_id}", response_model=PlayerOut)
def update_player(
    player_id: int,
    data: PlayerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.KINESIOLOGIST)),
):
    q = db.query(Player).filter(Player.id == player_id)
    q = scoped_query(q, Player, current_user)
    player = q.first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        # Block tenant escalation
        if field == "club_id":
            continue
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return db.query(Player).options(joinedload(Player.category)).filter(Player.id == player_id).first()


@router.post("/{player_id}/photo", response_model=PlayerOut)
def upload_player_photo(
    player_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH)),
):
    q = db.query(Player).filter(Player.id == player_id)
    q = scoped_query(q, Player, current_user)
    player = q.first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPEG, PNG o WebP")
    content = file.file.read()
    if len(content) > 1_000_000:  # 1 MB max
        raise HTTPException(status_code=400, detail="La imagen no puede superar 1 MB")
    b64 = base64.b64encode(content).decode("utf-8")
    player.photo_url = f"data:{file.content_type};base64,{b64}"
    db.commit()
    db.refresh(player)
    return db.query(Player).options(joinedload(Player.category)).filter(Player.id == player_id).first()


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_roles(UserRole.ADMIN)),
):
    q = db.query(Player).filter(Player.id == player_id)
    q = scoped_query(q, Player, current_user)
    player = q.first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    player.is_active = False
    db.commit()
