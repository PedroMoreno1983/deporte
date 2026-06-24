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
from collections import Counter
from dataclasses import dataclass, field
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
    identities:  List[Dict[str, Any]] = field(default_factory=list)  # ReID-merged players
    sample_path:  Optional[str] = None   # decorative thumbnail
    output_video: Optional[str] = None   # full annotated output.mp4
    output_dir:   Optional[str] = None
    error:        Optional[str] = None


def _aggregate_identities(
    tracks_summary: List[Dict[str, Any]],
    jerseys: Dict[int, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Collapse per-track rows sharing a ReID identity into per-player rows.

    Distance is summed across fragments, speed takes the peak, team is the most
    common assignment, jersey is the number with the most *pooled* votes
    (reusing C2's per-track vote counts), and the high-intensity event counts
    (C4) are summed across the identity's member tracks.
    """
    by_identity: Dict[int, List[Dict[str, Any]]] = {}
    for t in tracks_summary:
        iid = t.get("identity")
        if iid is None:
            continue
        by_identity.setdefault(int(iid), []).append(t)

    def _isum(members: List[Dict[str, Any]], key: str) -> int:
        return sum(int(m.get("intensity", {}).get(key, 0)) for m in members)

    out: List[Dict[str, Any]] = []
    for iid, members in sorted(by_identity.items()):
        team_votes = Counter(m["team"] for m in members if m.get("team") is not None)
        team_rep = team_votes.most_common(1)[0][0] if team_votes else None

        # Jersey: pool C2 vote counts across member tracks, pick the top number.
        jersey_votes: Counter = Counter()
        for m in members:
            jd = jerseys.get(int(m["track_id"]))
            if jd:
                jersey_votes[jd["number"]] += jd["votes"]
        jersey_rep = jersey_votes.most_common(1)[0][0] if jersey_votes else None

        top_speed = max(
            (float(m.get("intensity", {}).get("top_speed_kmh", 0.0)) for m in members),
            default=0.0,
        )
        out.append({
            "identity":   iid,
            "track_ids":  sorted(int(m["track_id"]) for m in members),
            "team":       team_rep,
            "jersey":     jersey_rep,
            "distance_m": round(sum(float(m.get("distance_m", 0.0)) for m in members), 1),
            "speed_kmh":  round(max((float(m.get("speed_kmh", 0.0)) for m in members), default=0.0), 1),
            "top_speed_kmh":     round(top_speed, 1),
            "sprints":           _isum(members, "sprints"),
            "accelerations":     _isum(members, "accelerations"),
            "decelerations":     _isum(members, "decelerations"),
            "direction_changes": _isum(members, "direction_changes"),
            "sprint_distance_m": round(
                sum(float(m.get("intensity", {}).get("sprint_distance_m", 0.0)) for m in members), 1),
        })
    return out


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
        from .model_loader    import load_detector
        from .tracker         import BoxTracker
        from .team_assigner   import TeamAssigner
        from .view_transformer import ViewTransformer
        from .speed_distance  import SpeedDistance
        from .jersey_ocr      import JerseyReader, JerseyVoter, torso_crop
        from .reid            import ColorHistogramEmbedder, ReIDGallery
        from .events          import EventDetector
        from .annotate        import MatchAnnotator, VideoSink
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

    # Resolve weights (explicit → env → fine-tuned on disk → base) and load the
    # matching class schema, so person/ball filtering is class-id-agnostic and
    # works for both the stock COCO model and a football fine-tune.
    detector    = load_detector(weights)
    person_ids  = detector.schema.person_class_ids
    log.info("Detector classes: %s | tracking ids %s",
             detector.schema.names, sorted(person_ids))
    tracker     = BoxTracker(fps=fps)
    team        = TeamAssigner()
    transformer = ViewTransformer(frame_w, frame_h)
    kinematics  = SpeedDistance()
    events      = EventDetector()   # sprints / accel / decel / direction changes

    # ── Jersey-number OCR (optional, lazy) ───────────────────────────────
    # Reading a number off a moving shirt is noisy per-frame, so we OCR each
    # player only every Nth processed frame and let JerseyVoter resolve a
    # stable number by confidence-weighted voting across the track's life.
    # Disabled cleanly if EasyOCR isn't installed or DEPORTE_CV_OCR=0.
    jersey_voter  = JerseyVoter()
    jersey_reader = None
    ocr_enabled   = os.getenv("DEPORTE_CV_OCR", "1").lower() not in {"0", "false", "no"}
    ocr_every     = max(1, int(os.getenv("DEPORTE_CV_OCR_EVERY", "5")))   # processed frames
    ocr_min_box_h = max(16, int(os.getenv("DEPORTE_CV_OCR_MIN_BOX_H", "44")))  # px
    if ocr_enabled:
        try:
            jersey_reader = JerseyReader(gpu=False)
            log.info("Jersey OCR enabled (every %d processed frames)", ocr_every)
        except Exception as e:  # noqa: BLE001 — missing/broken easyocr must not abort
            log.warning("Jersey OCR disabled (EasyOCR unavailable): %s", e)
            jersey_reader = None

    # ── Track re-identification (optional, pure-numpy) ───────────────────
    # ByteTrack hands out a fresh id whenever a player is occluded or leaves
    # and reappears, fragmenting per-player stats. The ReID gallery re-links
    # those fragments by torso-colour appearance so distance/speed/jersey are
    # aggregated per *player*, not per track fragment. Cheap (no GPU); toggle
    # with DEPORTE_CV_REID=0.
    reid_enabled  = os.getenv("DEPORTE_CV_REID", "1").lower() not in {"0", "false", "no"}
    reid_embedder = ColorHistogramEmbedder() if reid_enabled else None
    reid_gallery  = ReIDGallery()
    if reid_enabled:
        log.info("Track ReID enabled (colour-histogram appearance)")

    sample_crops: List[Any] = []
    last_emit = 0.0
    sample_path: Optional[str] = None
    processed = 0   # count of frames we actually ran inference on (after stride)

    # ── Performance knobs ────────────────────────────────────────────
    # `stride` = process 1 of every N frames. ByteTrack interpolates the rest,
    # so the timeline stays continuous while inference cost drops N×.
    # Set via env DEPORTE_CV_STRIDE; default 3 is a sweet spot on CPU.
    # `imgsz` controls YOLO inference resolution (default 640 vs 1280 reduces
    # cost ~2× with marginal recall loss on standard broadcast footage).
    stride = max(1, int(os.getenv("DEPORTE_CV_STRIDE", "5")))
    imgsz  = max(320, int(os.getenv("DEPORTE_CV_IMGSZ", "480")))

    # ── CPU resource limiting ─────────────────────────────────────────────
    # Cap PyTorch inter-op / intra-op threads so YOLO doesn't spawn N×CPU
    # threads and saturate the VPS. Defaults to 2; override with env.
    _torch_threads = max(1, int(os.getenv("DEPORTE_CV_TORCH_THREADS", "2")))
    try:
        import torch
        torch.set_num_threads(_torch_threads)
        torch.set_num_interop_threads(1)
        log.info("PyTorch threads capped to %d intra-op, 1 inter-op", _torch_threads)
    except Exception:  # noqa: BLE001
        pass
    # Lower process niceness so the CV worker doesn't starve the API.
    try:
        os.nice(10)
    except (AttributeError, OSError):
        pass  # Windows / permission error — ignore

    # ── Annotated output video (optional) ────────────────────────────────
    # Render a full output.mp4 with team-coloured boxes, "#jersey speed" labels
    # and a top-down pitch minimap. One annotated frame is written per *processed*
    # frame, so the clip plays back at fps/stride (real time). Toggle with
    # DEPORTE_CV_VIDEO=0; the codec is configurable via DEPORTE_CV_VIDEO_FOURCC.
    video_enabled = os.getenv("DEPORTE_CV_VIDEO", "1").lower() not in {"0", "false", "no"}
    video_fourcc  = os.getenv("DEPORTE_CV_VIDEO_FOURCC", "mp4v")
    out_fps       = max(1.0, fps / stride)
    annotator     = MatchAnnotator(frame_w, frame_h)
    video_path    = os.path.join(output_dir, "output.mp4")
    video_sink: Optional[Any] = None

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
        processed += 1
        do_ocr = jersey_reader is not None and (processed % ocr_every == 0)

        detections = detector.detect(frame, conf=0.25, imgsz=imgsz)
        # Keep persons only for team-assignment + tracking simplification.
        # `person_ids` comes from the loaded model's schema (COCO person, or the
        # fine-tune's player/goalkeeper/referee classes).
        persons = [d for d in detections if d.cls in person_ids]
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

        # Assign team + kinematics per track. Capture per-frame values for the
        # annotated-video overlay (speed, team, foot position on the pitch).
        frame_speeds: Dict[int, float] = {}
        frame_teams:  Dict[int, Optional[int]] = {}
        frame_feet:   Dict[int, Any] = {}
        for tr in tracks:
            x1, y1, x2, y2 = map(int, tr.bbox)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(frame_w, x2), min(frame_h, y2)
            crop = frame[y1:y2, x1:x2] if (x2 > x1 and y2 > y1) else None
            if crop is not None and crop.size > 0 and team._fitted:
                team.assign(tr.track_id, crop)
            fx, fy = transformer.bbox_foot_point(tr.bbox)
            x_m, y_m = transformer.to_pitch(fx, fy)
            speed_now, _dist = kinematics.update(tr.track_id, x_m, y_m, t_s)
            events.update(tr.track_id, x_m, y_m, t_s)
            frame_speeds[tr.track_id] = round(speed_now, 1)
            frame_teams[tr.track_id] = team.team_of(tr.track_id) if team._fitted else None
            frame_feet[tr.track_id] = (x_m, y_m)

            # Re-identify the track against the appearance gallery. Cheap enough
            # to run every processed frame, which keeps each identity's stored
            # appearance fresh. `processed` is the monotonic processed-frame
            # index used as the recency clock for active-track exclusion.
            if reid_embedder is not None:
                reid_gallery.assign(tr.track_id, reid_embedder.embed(crop), processed)

            # Jersey OCR on a cadence, only for boxes big enough to read.
            if do_ocr and (y2 - y1) >= ocr_min_box_h:
                tcrop = torso_crop(frame, tr.bbox)
                for num, conf in jersey_reader.read(tcrop):
                    jersey_voter.update(tr.track_id, num, conf)

        # ── Annotate: write to output.mp4 and/or grab the preview thumbnail ──
        # The thumbnail is a frame ~5s in with several active tracks. The full
        # video (when enabled) gets every processed frame. Both share one render
        # pass via MatchAnnotator, so the box/label/minimap style is identical.
        # Write EVERY processed frame to the video (even with no tracks, so the
        # clip's timing stays true); the thumbnail still waits for a busy frame.
        need_sample = sample_path is None and f >= int(fps * 5) and len(tracks) >= 4
        if video_enabled or need_sample:
            if team._fitted:
                annotator.team_colors = team.colours()
            # Best-effort live jersey numbers (the voter firms up over the track's life).
            frame_jerseys = {
                tr.track_id: (jr["number"] if (jr := jersey_voter.resolve(tr.track_id)) else None)
                for tr in tracks
            }
            annotated = annotator.annotate(
                frame, tracks,
                teams=frame_teams, speeds=frame_speeds,
                jerseys=frame_jerseys, feet_m=frame_feet,
            )
            if video_enabled:
                if video_sink is None:
                    try:
                        video_sink = VideoSink(
                            video_path, out_fps, (frame_w, frame_h), fourcc=video_fourcc
                        ).open()
                        log.info("Annotated video → %s @ %.1f fps", video_path, out_fps)
                    except Exception as e:  # noqa: BLE001 — a bad codec must not abort analysis
                        log.warning("Annotated video disabled (VideoWriter unavailable): %s", e)
                        video_enabled = False
                if video_sink is not None:
                    video_sink.write(annotated)
            if need_sample:
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
    if video_sink is not None:
        video_sink.release()
        log.info("Annotated video written: %d frames → %s", video_sink.frames_written, video_path)
    output_video = video_path if (video_sink is not None and video_sink.frames_written > 0) else None

    # If we never fit teams, do it now from whatever we got
    if not team._fitted and sample_crops:
        team.fit(sample_crops)

    # Resolve a stable jersey number per track from the accumulated votes.
    jerseys = jersey_voter.snapshot()
    if jerseys:
        log.info("Jersey numbers resolved for %d/%d tracks", len(jerseys), len(kinematics.tracks))

    # Re-identification: {track_id: identity_id}. Several fragmented track ids
    # may collapse onto one identity (the same player across occlusions).
    identities_map = reid_gallery.snapshot()

    # High-intensity events per track (sprints / accel / decel / COD).
    events_map = {int(e["track_id"]): e for e in events.summary()}

    # Build per-track summary
    tracks_summary: List[Dict[str, Any]] = []
    for k_snap in kinematics.snapshot():
        tid = k_snap["track_id"]
        jersey = jerseys.get(int(tid))
        ev = events_map.get(int(tid), {})
        tracks_summary.append({
            **k_snap,
            "team": team._cache.get(int(tid)),
            "jersey":        jersey["number"] if jersey else None,
            "jersey_detail": jersey,   # {number, confidence, votes, agreement} or None
            "identity":      identities_map.get(int(tid)),
            "intensity": {
                "sprints":           ev.get("sprints", 0),
                "accelerations":     ev.get("accelerations", 0),
                "decelerations":     ev.get("decelerations", 0),
                "direction_changes": ev.get("direction_changes", 0),
                "top_speed_kmh":     ev.get("top_speed_kmh", 0.0),
                "sprint_distance_m": ev.get("sprint_distance_m", 0.0),
                "events":            ev.get("events", []),
            },
        })

    # Aggregate fragmented tracks into per-player identities: pool distance,
    # take peak speed, and vote a representative team + jersey across members
    # (jersey weighted by C2's per-track vote counts).
    identities_summary = _aggregate_identities(tracks_summary, jerseys)
    if identities_summary:
        log.info("ReID merged %d tracks into %d identities",
                 len(tracks_summary), len(identities_summary))

    result = PipelineResult(
        fps=float(fps),
        duration_s=duration_s,
        frame_count=f,
        tracks=tracks_summary,
        team_colors=[list(c) for c in team.colours()],
        identities=identities_summary,
        sample_path=sample_path,
        output_video=output_video,
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
            "identities":  result.identities,
            "output_video": result.output_video,
        }, fp, ensure_ascii=False, indent=2)

    if on_progress:
        on_progress(PipelineProgress(
            frame=f, total=frame_count or f, fraction=1.0, fps=fps, stage="finish",
        ))

    log.info("CV done: %d frames, %d tracks", f, len(tracks_summary))
    return result
