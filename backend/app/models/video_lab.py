"""Commercial video analysis workspace: tags, generated clips and playlists."""
from __future__ import annotations

import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class VideoTagSource(str, enum.Enum):
    MANUAL = "manual"
    AI = "ai"
    IMPORT = "import"


class VideoTagStatus(str, enum.Enum):
    SUGGESTED = "suggested"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class VideoClipStatus(str, enum.Enum):
    VIRTUAL = "virtual"
    EXPORTING = "exporting"
    READY = "ready"
    FAILED = "failed"


class VideoTag(Base):
    __tablename__ = "video_tags"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=True, index=True)
    video_analysis_id = Column(Integer, ForeignKey("video_analyses.id"), nullable=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    action_type = Column(String, nullable=False, index=True)
    phase = Column(String, nullable=True, index=True)
    team_label = Column(String, nullable=True, index=True)
    event_s = Column(Float, nullable=False)
    start_s = Column(Float, nullable=False)
    end_s = Column(Float, nullable=False)
    pitch_x = Column(Float, nullable=True)
    pitch_y = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    source = Column(Enum(VideoTagSource), nullable=False, default=VideoTagSource.MANUAL, index=True)
    status = Column(Enum(VideoTagStatus), nullable=False, default=VideoTagStatus.CONFIRMED, index=True)
    note = Column(Text, nullable=True)
    color = Column(String, nullable=True)

    match = relationship("Match")
    video_analysis = relationship("VideoAnalysis")
    player = relationship("Player")
    clips = relationship("VideoClip", back_populates="tag", cascade="all, delete-orphan")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class VideoClip(Base):
    __tablename__ = "video_clips"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("video_tags.id"), nullable=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=True, index=True)
    video_analysis_id = Column(Integer, ForeignKey("video_analyses.id"), nullable=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    title = Column(String, nullable=False)
    action_type = Column(String, nullable=True, index=True)
    team_label = Column(String, nullable=True, index=True)
    start_s = Column(Float, nullable=False)
    end_s = Column(Float, nullable=False)
    duration_s = Column(Float, nullable=False)
    status = Column(Enum(VideoClipStatus), nullable=False, default=VideoClipStatus.VIRTUAL, index=True)
    output_path = Column(String, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    rating = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)
    export_error = Column(Text, nullable=True)

    tag = relationship("VideoTag", back_populates="clips")
    match = relationship("Match")
    video_analysis = relationship("VideoAnalysis")
    player = relationship("Player")
    playlist_items = relationship("VideoPlaylistItem", back_populates="clip", cascade="all, delete-orphan")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class VideoPlaylist(Base):
    __tablename__ = "video_playlists"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    purpose = Column(String, nullable=True, index=True)
    is_shared = Column(Boolean, nullable=False, default=False)
    share_token = Column(String, nullable=True, unique=True, index=True)

    items = relationship("VideoPlaylistItem", back_populates="playlist", cascade="all, delete-orphan")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class VideoPlaylistItem(Base):
    __tablename__ = "video_playlist_items"
    __table_args__ = (UniqueConstraint("playlist_id", "clip_id", name="uq_video_playlist_clip"),)

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("video_playlists.id"), nullable=False, index=True)
    clip_id = Column(Integer, ForeignKey("video_clips.id"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    note = Column(Text, nullable=True)

    playlist = relationship("VideoPlaylist", back_populates="items")
    clip = relationship("VideoClip", back_populates="playlist_items")

    created_at = Column(DateTime(timezone=True), server_default=func.now())