"""
Computer-vision endpoints.

POST   /cv/upload            multipart video upload → queues a VideoAnalysis
GET    /cv/                  list current club's analyses
GET    /cv/{id}              detailed view (results JSON)
GET    /cv/{id}/sample.jpg   sample annotated frame
GET    /cv/{id}/output.mp4   annotated video, when enabled
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
from ....schemas.video_analysis import VideoAnalysisOut, VideoAnalysisSummary, VideoAnalysisUpdate


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
    match_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(VideoAnalysis).order_by(VideoAnalysis.created_at.desc())
    q = scoped_query(q, VideoAnalysis, current_user)
    if match_id is not None:
        q = q.filter(VideoAnalysis.match_id == match_id)
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



def _env_flag(name: str, default: str) -> bool:
    return os.getenv(name, default).lower() not in {"0", "false", "no", "off"}


@router.get("/diagnostics")
def get_cv_diagnostics(
    current_user: User = Depends(get_current_user),
):
    """Operational snapshot for video analysis without loading YOLO/torch."""
    del current_user  # auth gate only

    from ....cv.model_loader import FINETUNED_BASENAME, cv_model_dir, resolve_weights, sidecar_path_for
    from ....worker.dispatch import broker_health

    model_dir = cv_model_dir()
    expected_finetune = model_dir / f"{FINETUNED_BASENAME}.pt"
    resolved = resolve_weights()
    broker = broker_health()

    runtime = {
        "cv_root": str(DATA_ROOT),
        "model_root": str(model_dir),
        "stride": int(os.getenv("DEPORTE_CV_STRIDE", "5")),
        "imgsz": int(os.getenv("DEPORTE_CV_IMGSZ", "480")),
        "ocr_enabled": _env_flag("DEPORTE_CV_OCR", "1"),
        "ocr_every": int(os.getenv("DEPORTE_CV_OCR_EVERY", "5")),
        "video_enabled": _env_flag("DEPORTE_CV_VIDEO", "1"),
        "torch_threads": int(os.getenv("DEPORTE_CV_TORCH_THREADS", "2")),
        "max_upload_mb": int(MAX_BYTES / 1024 / 1024),
        "allowed_extensions": sorted(ALLOWED_EXT),
    }
    ffmpeg_path = shutil.which("ffmpeg")
    dispatch_mode = "celery-worker" if broker.get("broker") == "up" else "api-background-fallback"

    warnings = []
    if not resolved.is_finetuned:
        warnings.append("Usando YOLO generico; carga players.pt + players.meta.json para deteccion de futbol.")
    if dispatch_mode != "celery-worker":
        warnings.append("Redis/worker no esta disponible; el analisis puede correr dentro del proceso API.")
    if runtime["ocr_enabled"]:
        warnings.append("OCR de camisetas encendido: en Hostinger CPU puede duplicar o triplicar el tiempo de proceso.")
    if runtime["video_enabled"]:
        warnings.append("Video anotado encendido: genera mas CPU y almacenamiento; dejalo apagado salvo para clips cortos.")
    if not ffmpeg_path:
        warnings.append("ffmpeg no esta disponible; algunos formatos pueden fallar antes del analisis.")

    return {
        "model": {
            "path": resolved.path,
            "source": resolved.source,
            "is_finetuned": resolved.is_finetuned,
            "class_names": resolved.class_names,
            "sidecar": str(sidecar_path_for(resolved.path)),
            "expected_finetune": str(expected_finetune),
            "expected_finetune_exists": expected_finetune.exists(),
            "env_checkpoint_set": bool(os.getenv("DEPORTE_YOLO_CKPT")),
        },
        "runtime": runtime,
        "infrastructure": {
            "dispatch_mode": dispatch_mode,
            "broker": broker,
            "ffmpeg": "available" if ffmpeg_path else "missing",
            "ffmpeg_path": ffmpeg_path,
            "upload_dir_exists": UPLOAD_DIR.exists(),
            "output_dir_exists": OUTPUT_DIR.exists(),
        },
        "warnings": warnings,
    }

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



@router.get("/{analysis_id}/output.mp4")
def get_output_video(
    analysis_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Full annotated output video, when the pipeline generated one."""
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
        raise HTTPException(status_code=404, detail="Sin video anotado disponible")

    base = Path(a.output_dir).resolve()
    rel = ((a.results or {}).get("output_video") if isinstance(a.results, dict) else None) or "output.mp4"
    output = (base / rel).resolve()
    if base not in output.parents and output != base:
        raise HTTPException(status_code=400, detail="Ruta de video invalida")
    if not output.exists() or not output.is_file():
        raise HTTPException(status_code=404, detail="Sin video anotado disponible")
    return FileResponse(str(output), media_type="video/mp4", filename=f"analysis-{analysis_id}-annotated.mp4")

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


@router.patch("/{analysis_id}", response_model=VideoAnalysisOut)
def update_analysis(
    analysis_id: int,
    data: VideoAnalysisUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id)
    q = scoped_query(q, VideoAnalysis, current_user)
    a = q.first()
    if not a:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")

    update_data = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
    if "name" in update_data:
        if update_data["name"] is not None:
            a.name = update_data["name"].strip()
    if "match_id" in update_data:
        a.match_id = update_data["match_id"]

    db.commit()
    db.refresh(a)
    return a

