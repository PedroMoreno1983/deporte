"""Video-analysis records — one per uploaded match clip processed by the CV pipeline."""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base


class CVStatus(str, enum.Enum):
    PENDING    = "pending"      # queued, file ready
    PROCESSING = "processing"   # pipeline running
    DONE       = "done"
    FAILED     = "failed"


class VideoAnalysis(Base):
    __tablename__ = "video_analyses"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    video_path  = Column(String, nullable=False)    # absolute path on disk
    output_dir  = Column(String, nullable=True)     # processed frames / overlay video
    duration_s  = Column(Float,  nullable=True)
    fps         = Column(Float,  nullable=True)
    frame_count = Column(Integer, nullable=True)

    status      = Column(Enum(CVStatus), nullable=False, default=CVStatus.PENDING, index=True)
    progress    = Column(Float, nullable=False, default=0.0)  # 0..1
    error       = Column(String, nullable=True)
    task_id     = Column(String, nullable=True, index=True)   # Celery task id, when queued async

    # JSON blob with: tracks, team_assignments, stats per player, formation, possession
    results     = Column(JSON, nullable=True)

    # Tenant scoping
    club_id     = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Optional link to an existing match
    match_id    = Column(Integer, ForeignKey("matches.id"), nullable=True, index=True)
    match       = relationship("Match")

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    started_at  = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
