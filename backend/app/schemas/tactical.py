from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class TacticalPlayCreate(BaseModel):
    name:             str
    formation:        str
    players_json:     Any
    assignments_json: Optional[Any] = None
    paths_json:       Optional[Any] = None


class TacticalPlayOut(BaseModel):
    id:               int
    name:             str
    formation:        str
    players_json:     Any
    assignments_json: Optional[Any] = None
    paths_json:       Optional[Any] = None
    created_at:       datetime

    class Config:
        from_attributes = True
