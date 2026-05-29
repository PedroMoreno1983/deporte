from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ....core.database import get_db
from ....core.deps import get_current_user, get_admin, get_current_club_id, scoped_query
from ....models.category import Category
from ....models.user import User
from ....schemas.category import CategoryCreate, CategoryOut

router = APIRouter()


@router.get("/", response_model=List[CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Category).filter(Category.is_active == True)
    q = scoped_query(q, Category, current_user)
    return q.order_by(Category.sort_order).all()


@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    club_id: int = Depends(get_current_club_id),
    _=Depends(get_admin),
):
    exists = db.query(Category).filter(
        Category.club_id == club_id, Category.code == data.code
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Código de categoría ya existe en este club")
    payload = data.model_dump()
    payload["club_id"] = club_id
    cat = Category(**payload)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(get_admin),
):
    q = db.query(Category).filter(Category.id == cat_id)
    q = scoped_query(q, Category, current_user)
    cat = q.first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cat.is_active = False
    db.commit()
