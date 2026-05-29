from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ....core.database import get_db
from ....core.deps import get_current_user, get_superadmin
from ....models.club import Club
from ....models.user import User
from ....schemas.club import ClubOut, ClubCreate, ClubUpdate

router = APIRouter()


@router.get("/me", response_model=ClubOut)
def get_my_club(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the club of the currently logged-in user."""
    if current_user.club_id is None:
        raise HTTPException(404, "Usuario sin club asignado")
    club = db.query(Club).filter(Club.id == current_user.club_id).first()
    if not club:
        raise HTTPException(404, "Club no encontrado")
    return club


@router.get("/", response_model=List[ClubOut])
def list_clubs(db: Session = Depends(get_db), _: User = Depends(get_superadmin)):
    """List all clubs — super-admin only."""
    return db.query(Club).order_by(Club.created_at.desc()).all()


@router.post("/", response_model=ClubOut, status_code=status.HTTP_201_CREATED)
def create_club(
    data: ClubCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    if db.query(Club).filter(Club.slug == data.slug).first():
        raise HTTPException(409, "Slug ya existe")
    club = Club(**data.model_dump())
    db.add(club)
    db.commit()
    db.refresh(club)
    return club


@router.patch("/{club_id}", response_model=ClubOut)
def update_club(
    club_id: int,
    data: ClubUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(404, "Club no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(club, k, v)
    db.commit()
    db.refresh(club)
    return club
