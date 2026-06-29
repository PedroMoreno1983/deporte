"""Background runner that takes a queued VideoAnalysis row and processes it.

For dev / small clubs this runs as a FastAPI `BackgroundTask`. For production
swap in a Celery/RQ worker — the function signature stays the same.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..core.database import SessionLocal
from ..models.video_analysis import VideoAnalysis, CVStatus
from ..websockets import manager, RealtimeEvent
from .pipeline import run_pipeline, PipelineProgress
from .transcode import normalise_video

log = logging.getLogger("cv.runner")


def process_video(analysis_id: int, video_path: str, output_dir: str, weights: Optional[str] = None) -> None:
    """Top-level entry point. Updates the DB row and broadcasts progress."""
    db = SessionLocal()
    try:
        analysis = db.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id).first()
        if not analysis:
            log.warning("Analysis %s vanished before processing", analysis_id)
            return

        analysis.status      = CVStatus.PROCESSING
        analysis.started_at  = datetime.utcnow()
        analysis.progress    = 0.0
        db.commit()

        _broadcast_progress(analysis_id, 0.0, "starting", analysis.club_id)

        last_pct = -1.0

        def on_progress(p: PipelineProgress) -> None:
            nonlocal last_pct
            pct = round(p.fraction * 100, 1)
            if pct - last_pct >= 0.5 or p.fraction >= 1.0:
                last_pct = pct
                # Update DB sparsely
                inner = SessionLocal()
                try:
                    a = inner.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id).first()
                    if a:
                        a.progress = p.fraction
                        inner.commit()
                finally:
                    inner.close()
                _broadcast_progress(analysis_id, p.fraction, p.stage, analysis.club_id)

        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # Normalise to a decodable, downscaled MP4 first (handles .webm/VP9 and
        # speeds up CPU detection). Falls back to the original on any failure.
        _broadcast_progress(analysis_id, 0.0, "preparing", analysis.club_id)
        proc_video = normalise_video(video_path, output_dir)

        result = run_pipeline(
            video_path=proc_video,
            output_dir=output_dir,
            weights=weights,
            on_progress=on_progress,
        )

        # Re-read row in case it was mutated externally
        analysis = db.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id).first()
        if not analysis:
            return

        if result.error:
            analysis.status = CVStatus.FAILED
            analysis.error  = result.error
        else:
            analysis.status      = CVStatus.DONE
            analysis.progress    = 1.0
            analysis.fps         = result.fps
            analysis.duration_s  = result.duration_s
            analysis.frame_count = result.frame_count
            analysis.output_dir  = result.output_dir
            analysis.results     = {
                "tracks":       result.tracks,
                "team_colors":  result.team_colors,
                "sample":       _relative(result.sample_path, output_dir),
                "output_video": _relative(result.output_video, output_dir),
                "identities":   result.identities,
            }
        analysis.finished_at = datetime.utcnow()
        db.commit()

        _broadcast_progress(analysis_id, 1.0, "done" if not result.error else "failed", analysis.club_id)

    except Exception as e:  # noqa: BLE001
        log.exception("CV pipeline failed for %s: %s", analysis_id, e)
        analysis = db.query(VideoAnalysis).filter(VideoAnalysis.id == analysis_id).first()
        if analysis:
            analysis.status = CVStatus.FAILED
            analysis.error  = str(e)
            analysis.finished_at = datetime.utcnow()
            db.commit()
            _broadcast_progress(analysis_id, analysis.progress, "failed", analysis.club_id)
    finally:
        db.close()


def _broadcast_progress(analysis_id: int, fraction: float, stage: str, club_id: int | None) -> None:
    try:
        manager.publish_sync(RealtimeEvent(
            topic="cv",
            type="cv.progress",
            payload={
                "analysis_id": analysis_id,
                "fraction":    round(fraction, 4),
                "stage":       stage,
                "club_id":     club_id,
            },
        ))
    except Exception:  # noqa: BLE001
        pass


def _relative(path: Optional[str], base: str) -> Optional[str]:
    if not path:
        return None
    try:
        return os.path.relpath(path, base).replace(os.sep, "/")
    except ValueError:
        return path
