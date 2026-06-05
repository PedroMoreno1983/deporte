from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ....core.database import get_db
from ....core.deps import get_current_user, require_roles, scoped_query
from ....models.match import Match, MatchStat
from ....models.match_event import MatchEvent
from ....models.player import Player
from ....models.user import UserRole
from ....schemas.match import MatchCreate, MatchOut, MatchStatCreate, MatchStatOut
from ....analytics import compute_match_analytics

router = APIRouter()


@router.get("/", response_model=List[MatchOut])
def list_matches(
    category_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = scoped_query(db.query(Match), Match, current_user)
    if category_id:
        q = q.filter(Match.category_id == category_id)
    return q.order_by(Match.date.desc()).offset(skip).limit(limit).all()


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
def get_match_stats(match_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # Gate on the parent match being in the caller's club (MatchStat has no club_id).
    match = scoped_query(db.query(Match), Match, current_user).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
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
def get_player_match_stats(player_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # Gate on the player belonging to the caller's club.
    player = scoped_query(db.query(Player), Player, current_user).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    return (
        db.query(MatchStat)
        .filter(MatchStat.player_id == player_id)
        .order_by(MatchStat.id.desc())
        .all()
    )


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    match = scoped_query(db.query(Match), Match, current_user).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return match


@router.get("/{match_id}/analytics")
def get_match_analytics(
    match_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Analítica espacial del partido a partir de sus eventos (``MatchEvent``):
    xG, mapa de remates, redes de pases, posesión y *field tilt*.

    Devuelve un *bundle* listo para graficar. Si el partido aún no tiene eventos
    importados (Wyscout), el bundle viene vacío pero con forma válida."""
    # Tenant scoping: only matches in the caller's club (404 otherwise — same
    # response as a non-existent match, so ids aren't enumerable cross-club).
    match = scoped_query(db.query(Match), Match, current_user).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    events = (
        scoped_query(db.query(MatchEvent), MatchEvent, current_user)
        .filter(MatchEvent.match_id == match_id)
        .order_by(MatchEvent.id.asc())   # insertion order == chronological (Wyscout file order)
        .all()
    )
    own = next((e.team_name for e in events if e.is_own_team), None)

    bundle = compute_match_analytics(events, own_team=own)
    bundle["match"] = {
        "id": match.id,
        "date": match.date.isoformat() if match.date else None,
        "opponent": match.opponent,
        "competition": getattr(match, "competition", None),
        "is_home": getattr(match, "is_home", None),
    }
    return bundle
