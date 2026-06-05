from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user, scoped_query
from app.models.tactical import Tactical

router = APIRouter()


class TacticalCreate(BaseModel):
    name: str
    formation: str
    players_json: str | None = None
    assignments_json: str | None = None
    paths_json: str | None = None


class TacticalOut(BaseModel):
    id: int
    name: str
    formation: str
    players_json: str | None = None
    assignments_json: str | None = None
    paths_json: str | None = None
    created_at: str | None = None

    class Config:
        from_attributes = True


@router.get("/", response_model=List[TacticalOut])
def list_tacticals(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items = (
        scoped_query(db.query(Tactical), Tactical, current_user)
        .order_by(Tactical.created_at.desc())
        .all()
    )
    return items


@router.post("/", response_model=TacticalOut)
def create_tactical(
    body: TacticalCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = Tactical(
        name=body.name,
        formation=body.formation,
        players_json=body.players_json,
        assignments_json=body.assignments_json,
        paths_json=body.paths_json,
        club_id=getattr(current_user, "club_id", None),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{id}")
def delete_tactical(
    id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = scoped_query(db.query(Tactical), Tactical, current_user).filter(Tactical.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Táctica no encontrada")
    db.delete(item)
    db.commit()
    return {"ok": True}
