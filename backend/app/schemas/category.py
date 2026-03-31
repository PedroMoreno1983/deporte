from pydantic import BaseModel
from typing import Optional


class CategoryCreate(BaseModel):
    name: str
    code: str
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    sort_order: int = 0


class CategoryOut(BaseModel):
    id: int
    name: str
    code: str
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True
