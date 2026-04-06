from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ....database import get_db
from ....models.tactical import TacticalPlay
from ....schemas.tactical import TacticalPlayCreate, TacticalPlayOut
from ....core.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[TacticalPlayOut])
def list_plays(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(TacticalPlay)
        .order_by(TacticalPlay.created_at.desc())
        .all()
    )


@router.post("/", response_model=TacticalPlayOut)
def create_play(
    data: TacticalPlayCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    play = TacticalPlay(**data.model_dump())
    db.add(play)
    db.commit()
    db.refresh(play)
    return play


@router.delete("/{play_id}")
def delete_play(
    play_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    play = db.query(TacticalPlay).filter(TacticalPlay.id == play_id).first()
    if not play:
        raise HTTPException(status_code=404, detail="Jugada no encontrada")
    db.delete(play)
    db.commit()
    return {"ok": True}
