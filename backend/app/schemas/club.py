from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ClubBase(BaseModel):
    name:      str
    slug:      str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    country:   Optional[str] = None
    league:    Optional[str] = None
    crest_url: Optional[str] = None


class ClubCreate(ClubBase):
    pass


class ClubUpdate(BaseModel):
    name:        Optional[str] = None
    country:     Optional[str] = None
    league:      Optional[str] = None
    crest_url:   Optional[str] = None
    is_active:   Optional[bool] = None
    ai_provider: Optional[str] = None
    ai_api_key:  Optional[str] = None
    ai_model:    Optional[str] = None


class ClubOut(ClubBase):
    id:              int
    is_active:       bool
    ai_provider:     Optional[str] = None
    ai_model:        Optional[str] = None
    has_ai_api_key:  bool = False
    created_at:      datetime
    model_config = ConfigDict(from_attributes=True)

