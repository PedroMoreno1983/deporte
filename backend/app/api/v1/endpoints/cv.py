"""
Computer-vision endpoints.

POST   /cv/upload            multipart video upload → queues a VideoAnalysis
GET    /cv/                  list current club's analyses
GET    /cv/{id}              detailed view (results JSON)
GET    /cv/{id}/sample.jpg   sample annotated frame
DELETE /cv/{id}              remove analysis row + files (admin only)

Heavy processing is dispatched as a FastAPI `BackgroundTask`. WS topic `cv`
streams `cv.progress` events.
"""
from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....core.deps import get_current_user, get_current_club_id, scoped_query
from ....core.permissions import require_permission
from ....core.audit import audit
from ....models.user import User
from ....models.video_analysis import VideoAnalysis, CVStatus
from ....schemas.video_analysis import VideoAnalysisOut, VideoAnalysisSummary


router = APIRouter()

# Where uploaded videos live. Configurable via env so prod can mount a volume.
DATA_ROOT = Path(os.getenv("DEPORTE_CV_ROOT", "./cv_data")).resolve()
UPLOAD_DIR = DATA_ROOT / "uploads"
OUTPUT_DIR = DATA_ROOT / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
MAX_BYTES   = 500 * 1024 * 1024  # 500 MB


@router.get("/", response_model=List[VideoAnalysisSummary])
def list_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(VideoAnalysis).order_by(VideoAnalysis.created_at.desc())
    q = scoped_query(q, VideoAnalysis, current_user)
    return q.limit(100).all()


@router.post("/upload", response_model=VideoAnalysisOut, status_code=status.HTTP_201_CREATED)
def upload_video(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(""),
    match_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    club_id: int = Depends(get_current_club_id),
    current_user: User = Depends(require_permission("cv:upload")),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Formato no soportado: {ext or 'desconocido'}")

    # Stream to disk respecting MAX_BYTES
    safe_name = f"{uuid.uuid4().hex}{ext}"
    final_path = UPLOAD_DIR / safe_name
    written = 0
    with final_path.open("wb") as out:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_BYTES:
                out.close()
                final_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Video supera 500 MB")
            out.write(chunk)

    output_dir = OUTPUT_DIR / safe_name.removesuffix(ext)
    output_dir.mkdir(parents=True, exist_ok=True)

    analysis = VideoAnalysis(
        name        = name.strip() or (file.filename or safe_name),
        video_path  = str(final_path),
        output_dir  = str(output_dir),
        status      = CVStatus.PENDING,
        progress    = 0.0,
        club_id     = club_id,
        uploaded_by = current_user.id,
        match_id    = match_id,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    audit(
        db, user=current_user,
        action="video_analysis.upload",
        entity="VideoAnalysis", entity_id=analysis.id,
        delta={"size_bytes": written, "filename": file.filename},
    )

    # Kick off the pipeline on the Celery queue when a broker is reachable,
    # else fall back to the in-process FastAPI BackgroundTask (dev / no Redis).
    from ....worker.dispatch import dispatch_video_analysis

    dispatched = dispatch_video_analysis(
        analysis.id, str(final_path), str(output_dir), background=background
    )
    if dispatched.get("task_id"):
        analysis.task_id = dispatched["task_id"]
        db.commit()
        db.refresh(analysis)
    return analysis


@router.get("/{analysis_id}", response_model=VideoAnalysisOut)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id)
    q = scoped_query(q, VideoAnalysis, current_user)
    a = q.first()
    if not a:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    return a


@router.get("/{analysis_id}/sample.jpg")
def get_sample(
    analysis_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Sample annotated frame.

    Accepts auth either via the standard Authorization header or via
    `?token=<JWT>` query — browsers can't attach custom headers to
    `<img src>` requests so the query-string fallback lets the UI embed
    the image directly.
    """
    from ....core.security import decode_token
    user: Optional[User] = None
    if token:
        payload = decode_token(token)
        if payload and payload.get("type") == "access" and payload.get("sub"):
            user = db.query(User).filter(
                User.id == int(payload["sub"]), User.is_active.is_(True),
            ).first()
    if not user:
        raise HTTPException(status_code=401, detail="No autorizado")
    q = db.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id)
    q = scoped_query(q, VideoAnalysis, user)
    a = q.first()
    if not a or not a.output_dir:
        raise HTTPException(status_code=404, detail="Sin frame disponible")
    sample = Path(a.output_dir) / "sample.jpg"
    if not sample.exists():
        raise HTTPException(status_code=404, detail="Sin frame disponible")
    return FileResponse(str(sample), media_type="image/jpeg")


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cv:delete")),
):
    q = db.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id)
    q = scoped_query(q, VideoAnalysis, current_user)
    a = q.first()
    if not a:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    # Best-effort filesystem cleanup
    for path in (a.video_path, a.output_dir):
        if path:
            p = Path(path)
            if p.is_file():
                p.unlink(missing_ok=True)
            elif p.is_dir():
                shutil.rmtree(p, ignore_errors=True)
    db.delete(a)
    db.commit()
    audit(db, user=current_user, action="video_analysis.delete", entity="VideoAnalysis", entity_id=analysis_id)
