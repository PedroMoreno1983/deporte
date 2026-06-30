from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, model_validator

class VideoTagCreate(BaseModel):
    match_id: Optional[int] = None
    video_analysis_id: Optional[int] = None
    player_id: Optional[int] = None
    action_type: str = Field(..., min_length=2, max_length=64)
    phase: Optional[str] = None
    team_label: Optional[str] = None
    event_s: float = Field(..., ge=0)
    start_s: Optional[float] = Field(default=None, ge=0)
    end_s: Optional[float] = Field(default=None, ge=0)
    clip_margin_s: float = Field(default=6, ge=1, le=30)
    pitch_x: Optional[float] = Field(default=None, ge=0, le=100)
    pitch_y: Optional[float] = Field(default=None, ge=0, le=100)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    source: str = "manual"
    status: str = "confirmed"
    note: Optional[str] = None
    color: Optional[str] = None

    @model_validator(mode="after")
    def derive_window(self):
        if self.start_s is None:
            self.start_s = max(0.0, self.event_s - self.clip_margin_s)
        if self.end_s is None:
            self.end_s = self.event_s + self.clip_margin_s
        if self.end_s <= self.start_s:
            raise ValueError("end_s debe ser mayor que start_s")
        return self

class VideoTagUpdate(BaseModel):
    player_id: Optional[int] = None
    action_type: Optional[str] = None
    phase: Optional[str] = None
    team_label: Optional[str] = None
    event_s: Optional[float] = Field(default=None, ge=0)
    start_s: Optional[float] = Field(default=None, ge=0)
    end_s: Optional[float] = Field(default=None, ge=0)
    pitch_x: Optional[float] = Field(default=None, ge=0, le=100)
    pitch_y: Optional[float] = Field(default=None, ge=0, le=100)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    status: Optional[str] = None
    note: Optional[str] = None
    color: Optional[str] = None

class VideoClipCreate(BaseModel):
    match_id: Optional[int] = None
    video_analysis_id: Optional[int] = None
    player_id: Optional[int] = None
    title: str = Field(..., min_length=2, max_length=160)
    action_type: Optional[str] = None
    team_label: Optional[str] = None
    start_s: float = Field(..., ge=0)
    end_s: float = Field(..., ge=0)
    note: Optional[str] = None

    @model_validator(mode="after")
    def valid_window(self):
        if self.end_s <= self.start_s:
            raise ValueError("end_s debe ser mayor que start_s")
        return self

class VideoClipUpdate(BaseModel):
    player_id: Optional[int] = None
    title: Optional[str] = None
    action_type: Optional[str] = None
    team_label: Optional[str] = None
    start_s: Optional[float] = Field(default=None, ge=0)
    end_s: Optional[float] = Field(default=None, ge=0)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    note: Optional[str] = None

class VideoClipOut(BaseModel):
    id: int
    club_id: int
    tag_id: Optional[int] = None
    match_id: Optional[int] = None
    video_analysis_id: Optional[int] = None
    player_id: Optional[int] = None
    title: str
    action_type: Optional[str] = None
    team_label: Optional[str] = None
    start_s: float
    end_s: float
    duration_s: float
    status: str
    output_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    rating: Optional[int] = None
    note: Optional[str] = None
    export_error: Optional[str] = None
    created_at: datetime
    player_name: Optional[str] = None
    player_jersey: Optional[int] = None
    match_label: Optional[str] = None
    video_name: Optional[str] = None

    class Config:
        from_attributes = True

class VideoTagOut(BaseModel):
    id: int
    club_id: int
    match_id: Optional[int] = None
    video_analysis_id: Optional[int] = None
    player_id: Optional[int] = None
    action_type: str
    phase: Optional[str] = None
    team_label: Optional[str] = None
    event_s: float
    start_s: float
    end_s: float
    pitch_x: Optional[float] = None
    pitch_y: Optional[float] = None
    confidence: Optional[float] = None
    source: str
    status: str
    note: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime
    clip: Optional[VideoClipOut] = None

    class Config:
        from_attributes = True

class VideoPlaylistCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    description: Optional[str] = None
    purpose: Optional[str] = None
    is_shared: bool = False

class VideoPlaylistOut(BaseModel):
    id: int
    club_id: int
    title: str
    description: Optional[str] = None
    purpose: Optional[str] = None
    is_shared: bool
    share_token: Optional[str] = None
    created_at: datetime
    clips_count: int = 0

    class Config:
        from_attributes = True

class VideoPlaylistUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    purpose: Optional[str] = None
    is_shared: Optional[bool] = None

class VideoPlaylistDetailOut(VideoPlaylistOut):
    clips: list[VideoClipOut] = Field(default_factory=list)

class AddClipToPlaylist(BaseModel):
    clip_id: int
    sort_order: int = 0
    note: Optional[str] = None


class VideoLabImportResult(BaseModel):
    analysis_id: int
    total_candidates: int
    created_tags: int
    created_clips: int
    matched_players: int
    skipped_existing: int

class VideoLabSummary(BaseModel):
    clips: int
    tags: int
    players_tagged: int
    playlists: int
    exported_clips: int
    unassigned_clips: int
