"""Normalise any uploaded video to a CV-friendly MP4 before processing.

OpenCV's ``VideoCapture`` fails to decode some containers/codecs (notably
VP9/.webm from YouTube), silently yielding 0 frames. We run every input
through ffmpeg once to produce a baseline **H.264 / yuv420p MP4**, scaled down
and frame-rate capped. This does two things at once:

  1. Guarantees the pipeline can actually read the frames (any input format).
  2. Speeds up the CPU pipeline a lot — broadcast footage is often 1080p60;
     720p25 is ~5× less pixels/second to detect on.

If ffmpeg is unavailable we fall back to the original path (best effort) so the
behaviour degrades rather than hard-failing.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path

log = logging.getLogger("cv.transcode")

MAX_WIDTH = 1280      # cap the long edge; broadcast 1080p → 720p is plenty for detection
TARGET_FPS = 25       # cap frame rate; 50/60 fps adds cost without analytic value


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def normalise_video(src: str, work_dir: str, *, max_width: int = MAX_WIDTH, fps: int = TARGET_FPS) -> str:
    """Return a path to a decodable MP4 for the pipeline to consume.

    Transcodes ``src`` via ffmpeg into ``work_dir``. Returns the original path
    unchanged if ffmpeg is missing or the transcode fails (so OpenCV still gets
    a chance to read the source directly).
    """
    src_path = Path(src)
    if not ffmpeg_available():
        log.warning("ffmpeg not found; using original video as-is (%s)", src_path.name)
        return src

    out = Path(work_dir) / f"{src_path.stem}.norm.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)

    # scale to <= max_width keeping aspect ratio; -2 keeps height even (H.264 needs it)
    vf = f"scale='min({max_width},iw)':-2,fps={fps}"
    cmd = [
        "ffmpeg", "-y",
        "-i", str(src_path),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
        "-pix_fmt", "yuv420p",
        "-an",                       # audio is irrelevant to the CV pipeline
        "-movflags", "+faststart",
        str(out),
    ]
    log.info("Transcoding %s -> %s", src_path.name, out.name)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60 * 60)
    except Exception as exc:  # noqa: BLE001 — ffmpeg crash / timeout
        log.error("ffmpeg transcode raised (%s); using original", exc)
        return src

    if proc.returncode != 0 or not out.exists() or out.stat().st_size == 0:
        tail = (proc.stderr or "")[-800:]
        log.error("ffmpeg transcode failed (rc=%s); using original. stderr: %s", proc.returncode, tail)
        return src

    return str(out)
