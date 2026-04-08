from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ....core.database import get_db
from ....core.deps import get_current_user, require_roles
from ....models.match import Match, MatchStat
from ....models.user import UserRole
from ....schemas.match import MatchCreate, MatchOut, MatchStatCreate, MatchStatOut

router = APIRouter()


@router.get("/", response_model=List[MatchOut])
def list_matches(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Match)
    if category_id:
        q = q.filter(Match.category_id == category_id)
    return q.order_by(Match.date.desc()).all()


@router.post("/", response_model=MatchOut, status_code=status.HTTP_201_CREATED)
def create_match(
    data: MatchCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
):
    match = Match(**data.model_dump())
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


@router.get("/{match_id}/stats", response_model=List[MatchStatOut])
def get_match_stats(match_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(MatchStat).filter(MatchStat.match_id == match_id).all()


@router.post("/stats", response_model=MatchStatOut, status_code=status.HTTP_201_CREATED)
def create_match_stat(
    data: MatchStatCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
):
    stat = MatchStat(**data.model_dump())
    db.add(stat)
    db.commit()
    db.refresh(stat)
    return stat


@router.get("/player/{player_id}/stats", response_model=List[MatchStatOut])
def get_player_match_stats(player_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(MatchStat)
        .filter(MatchStat.player_id == player_id)
        .order_by(MatchStat.id.desc())
        .all()
    )


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return match
