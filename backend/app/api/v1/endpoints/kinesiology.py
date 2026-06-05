from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ....core.database import get_db
from ....core.deps import get_current_user, require_roles, scoped_query, get_player_in_club
from ....models.kinesiology import KinesiologyRecord
from ....models.player import Player
from ....models.user import User, UserRole
from ....schemas.kinesiology import KinesiologyCreate, KinesiologyOut

router = APIRouter()


@router.get("/player/{player_id}", response_model=List[KinesiologyOut])
def get_player_records(player_id: int, db: Session = Depends(get_db), _player=Depends(get_player_in_club)):
    return (
        db.query(KinesiologyRecord)
        .filter(KinesiologyRecord.player_id == player_id)
        .order_by(KinesiologyRecord.evaluation_date.desc())
        .all()
    )


@router.post("/", response_model=KinesiologyOut, status_code=status.HTTP_201_CREATED)
def create_record(
    data: KinesiologyCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.KINESIOLOGIST)),
):
    # Auto-calculate BMI if possible
    payload = data.model_dump()
    if payload.get("weight_kg") and payload.get("height_cm"):
        h_m = payload["height_cm"] / 100
        payload["bmi"] = round(payload["weight_kg"] / (h_m ** 2), 2)

    record = KinesiologyRecord(**payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _record_in_club_or_404(record, db: Session, current_user: User) -> None:
    """A kinesiology record belongs to a player; enforce that player's club."""
    if record is None:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    in_club = scoped_query(db.query(Player), Player, current_user).filter(
        Player.id == record.player_id
    ).first()
    if in_club is None:
        raise HTTPException(status_code=404, detail="Registro no encontrado")


@router.get("/{record_id}", response_model=KinesiologyOut)
def get_record(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(KinesiologyRecord).filter(KinesiologyRecord.id == record_id).first()
    _record_in_club_or_404(record, db, current_user)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.KINESIOLOGIST)),
):
    record = db.query(KinesiologyRecord).filter(KinesiologyRecord.id == record_id).first()
    _record_in_club_or_404(record, db, current_user)
    db.delete(record)
    db.commit()
