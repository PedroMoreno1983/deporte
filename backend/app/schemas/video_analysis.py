from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict

from ..models.video_analysis import CVStatus


class VideoAnalysisOut(BaseModel):
    id:           int
    name:         str
    status:       CVStatus
    progress:     float
    error:        Optional[str] = None
    duration_s:   Optional[float] = None
    fps:          Optional[float] = None
    frame_count:  Optional[int] = None
    match_id:     Optional[int] = None
    results:      Optional[Dict[str, Any]] = None
    created_at:   datetime
    started_at:   Optional[datetime] = None
    finished_at:  Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VideoAnalysisSummary(BaseModel):
    id:          int
    name:        str
    status:      CVStatus
    progress:    float
    duration_s:  Optional[float] = None
    created_at:  datetime
    finished_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
