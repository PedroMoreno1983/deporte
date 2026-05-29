"""End-to-end CV pipeline.

Read a video → detect → track → assign teams → transform to pitch → log
speed/distance per track → write annotated frames + JSON results.

All heavy imports are lazy so a misconfigured server still serves the rest of
the API. Progress is reported via the `on_progress` callback every K frames.
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

log = logging.getLogger("cv.pipeline")


@dataclass
class PipelineProgress:
    frame:     int
    total:     int
    fraction:  float
    fps:       float
    stage:     str  # "detect" | "track" | "team-fit" | "finish"


@dataclass
class PipelineResult:
    fps:         float
    duration_s:  float
    frame_count: int
    tracks:      List[Dict[str, Any]]   # per-track summary
    team_colors: List[List[int]]        # BGR for team 0 and 1
    sample_path: Optional[str] = None   # decorative thumbnail
    output_dir:  Optional[str] = None
    error:       Optional[str] = None


def run_pipeline(
    video_path: str,
    output_dir: str,
    *,
    weights: Optional[str] = None,
    on_progress: Optional[Callable[[PipelineProgress], None]] = None,
    sample_every: int = 5,          # team-fit sampling cadence
    max_frames: Optional[int] = None,
) -> PipelineResult:
    """Run the full pipeline against `video_path`. Writes results to `output_dir`."""
    try:
        import cv2
        import numpy as np
        from .detector        import YoloDetector, PERSON_CLASSES
        from .tracker         import BoxTracker
        from .team_assigner   import TeamAssigner
        from .view_transformer import ViewTransformer
        from .speed_distance  import SpeedDistance
    except ImportError as e:
        return PipelineResult(
            fps=0.0, duration_s=0.0, frame_count=0,
            tracks=[], team_colors=[],
            error=f"CV dependencies missing: {e}. Run `pip install -r requirements.txt`.",
        )

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return PipelineResult(
            fps=0.0, duration_s=0.0, frame_count=0,
            tracks=[], team_colors=[],
            error=f"Could not open video: {video_path}",
        )

    fps         = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_s  = frame_count / fps if fps > 0 else 0.0
    if max_frames:
        frame_count = min(frame_count, max_frames)

    log.info("CV start: %s | %dx%d @ %.1ffps | %d frames", video_path, frame_w, frame_h, fps, frame_count)

    detector    = YoloDetector(weights or "yolov8n.pt")
    tracker     = BoxTracker(fps=fps)
    team        = TeamAssigner()
    transformer = ViewTransformer(frame_w, frame_h)
    kinematics  = SpeedDistance()

    sample_crops: List[Any] = []
    last_emit = 0.0
    sample_path: Optional[str] = None

    # ── Performance knobs ────────────────────────────────────────────
    # `stride` = process 1 of every N frames. ByteTrack interpolates the rest,
    # so the timeline stays continuous while inference cost drops N×.
    # Set via env DEPORTE_CV_STRIDE; default 3 is a sweet spot on CPU.
    # `imgsz` controls YOLO inference resolution (default 640 vs 1280 reduces
    # cost ~2× with marginal recall loss on standard broadcast footage).
    stride = max(1, int(os.getenv("DEPORTE_CV_STRIDE", "3")))
    imgsz  = max(320, int(os.getenv("DEPORTE_CV_IMGSZ", "640")))

    f = 0
    while True:
        if max_frames and f >= max_frames:
            break
        ok, frame = cap.read()
        if not ok:
            break
        # Skip frames between strides — far cheaper than reading
        # everything and dropping work later.
        if f % stride != 0:
            f += 1
            continue
        t_s = f / fps

        detections = detector.detect(frame, conf=0.25, imgsz=imgsz)
        # Keep persons only for team-assignment + tracking simplification
        persons = [d for d in detections if d.cls in PERSON_CLASSES]
        tracks  = tracker.update(persons)

        # Collect a few crops for team K-means fit (first ~80 frames or until 30 crops)
        if not team._fitted and f % sample_every == 0:
            for tr in tracks[:8]:
                x1, y1, x2, y2 = map(int, tr.bbox)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(frame_w, x2), min(frame_h, y2)
                if x2 > x1 and y2 > y1:
                    sample_crops.append(frame[y1:y2, x1:x2].copy())
            if len(sample_crops) >= 30:
                team.fit(sample_crops)
                log.info("Team K-means fitted on %d crops", len(sample_crops))

        # Assign team + kinematics per track
        for tr in tracks:
            x1, y1, x2, y2 = map(int, tr.bbox)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(frame_w, x2), min(frame_h, y2)
            crop = frame[y1:y2, x1:x2] if (x2 > x1 and y2 > y1) else None
            if crop is not None and crop.size > 0 and team._fitted:
                team.assign(tr.track_id, crop)
            fx, fy = transformer.bbox_foot_point(tr.bbox)
            x_m, y_m = transformer.to_pitch(fx, fy)
            kinematics.update(tr.track_id, x_m, y_m, t_s)

        # Save a sample annotated frame once — pick a frame ~5s in with several
        # active tracks so the user sees a useful preview. Draw bbox + track id
        # + team colour overlay so the analysis is visually obvious.
        if sample_path is None and f >= int(fps * 5) and len(tracks) >= 4:
            annotated = frame.copy()
            for tr in tracks:
                x1, y1, x2, y2 = map(int, tr.bbox)
                team_idx = team.team_of(tr.track_id) if team._fitted else None
                if team_idx is None:
                    color = (255, 255, 255)
                else:
                    bgr = team.team_color_bgr(team_idx)
                    color = (int(bgr[0]), int(bgr[1]), int(bgr[2]))
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                # Track id label with filled background for legibility
                label = f"#{tr.track_id}"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(annotated, (x1, y1 - th - 8), (x1 + tw + 6, y1), color, -1)
                cv2.putText(annotated, label, (x1 + 3, y1 - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
            sample_path = os.path.join(output_dir, "sample.jpg")
            cv2.imwrite(sample_path, annotated)

        if on_progress and (time.time() - last_emit) > 0.4:
            on_progress(PipelineProgress(
                frame=f, total=frame_count or 0,
                fraction=(f / frame_count) if frame_count else 0.0,
                fps=fps, stage="team-fit" if not team._fitted else "track",
            ))
            last_emit = time.time()

        f += 1

    cap.release()

    # If we never fit teams, do it now from whatever we got
    if not team._fitted and sample_crops:
        team.fit(sample_crops)

    # Build per-track summary
    tracks_summary: List[Dict[str, Any]] = []
    for k_snap in kinematics.snapshot():
        tid = k_snap["track_id"]
        tracks_summary.append({
            **k_snap,
            "team": team._cache.get(int(tid)),
        })

    result = PipelineResult(
        fps=float(fps),
        duration_s=duration_s,
        frame_count=f,
        tracks=tracks_summary,
        team_colors=[list(c) for c in team.colours()],
        sample_path=sample_path,
        output_dir=output_dir,
    )

    # Persist JSON alongside the output dir
    with open(os.path.join(output_dir, "results.json"), "w", encoding="utf-8") as fp:
        json.dump({
            "fps":         result.fps,
            "duration_s":  result.duration_s,
            "frame_count": result.frame_count,
            "tracks":      result.tracks,
            "team_colors": result.team_colors,
        }, fp, ensure_ascii=False, indent=2)

    if on_progress:
        on_progress(PipelineProgress(
            frame=f, total=frame_count or f, fraction=1.0, fps=fps, stage="finish",
        ))

    log.info("CV done: %d frames, %d tracks", f, len(tracks_summary))
    return result
