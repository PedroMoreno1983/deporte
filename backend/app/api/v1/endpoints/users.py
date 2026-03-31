from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ....core.database import get_db
from ....core.deps import get_admin, get_current_user
from ....core.security import get_password_hash
from ....models.user import User
from ....schemas.user import UserCreate, UserUpdate, UserOut

router = APIRouter()


@router.get("/", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(get_admin)):
    return db.query(User).all()


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: Session = Depends(get_db), _=Depends(get_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), _=Depends(get_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()
