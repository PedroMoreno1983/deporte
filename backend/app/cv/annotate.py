"""Render an annotated match video (``output.mp4``) from pipeline tracks.

The pure-python helpers (label text, team colour, minimap-coordinate math) are
deliberately split from the OpenCV drawing so the formatting logic is unit
testable without cv2 installed. ``MatchAnnotator`` and ``VideoSink`` lazily
import cv2 and are only exercised when the CV deps are present.

The annotator draws, per frame: a team-coloured box per player, a compact
``#jersey speed`` label, and a top-down pitch minimap inset with one dot per
player — so a coach can see formation and movement at a glance.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

from .view_transformer import PITCH_H_M, PITCH_W_M

# Defaults mirror TeamAssigner's fallback colours so a non-fitted clip still
# renders sensibly. BGR (OpenCV order).
_TEAM0_BGR = (0, 255, 135)
_TEAM1_BGR = (233, 165, 14)
_UNKNOWN_BGR = (255, 255, 255)

BGR = Tuple[int, int, int]


# ── pure helpers (no cv2) ───────────────────────────────────────────────────────
def team_color_bgr(team_idx: Optional[int], team_colors: Optional[Sequence[Sequence[int]]] = None) -> BGR:
    """Resolve a track's box colour from its team index.

    Uses the fitted ``team_colors`` (as returned by ``TeamAssigner.colours()``)
    when available, else a stable default per team; white for unknown/None.
    """
    if team_idx is None:
        return _UNKNOWN_BGR
    if team_colors and 0 <= team_idx < len(team_colors):
        c = team_colors[team_idx]
        return (int(c[0]), int(c[1]), int(c[2]))
    return _TEAM0_BGR if team_idx == 0 else _TEAM1_BGR


def player_label(track_id: int, *, jersey: Optional[int] = None) -> str:
    """Human-facing tag: the jersey number when known, else the raw track id."""
    return f"#{jersey}" if jersey is not None else f"t{track_id}"


def speed_label(speed_kmh: Optional[float]) -> str:
    """Compact on-frame speed, or '' when there's nothing meaningful to show."""
    if speed_kmh is None or speed_kmh <= 0.0:
        return ""
    return f"{speed_kmh:.0f}km/h"


def box_caption(track_id: int, *, jersey: Optional[int] = None, speed_kmh: Optional[float] = None) -> str:
    """Full caption drawn above a player's box."""
    sl = speed_label(speed_kmh)
    label = player_label(track_id, jersey=jersey)
    return f"{label} {sl}".strip()


def pitch_to_minimap(
    x_m: float,
    y_m: float,
    map_w: int,
    map_h: int,
    *,
    margin: int = 4,
    pitch_w: float = PITCH_W_M,
    pitch_h: float = PITCH_H_M,
) -> Tuple[int, int]:
    """Map pitch metres → integer pixel inside a (map_w × map_h) minimap, clamped."""
    inner_w = max(1, map_w - 2 * margin)
    inner_h = max(1, map_h - 2 * margin)
    fx = min(max(x_m / pitch_w, 0.0), 1.0)
    fy = min(max(y_m / pitch_h, 0.0), 1.0)
    return margin + int(round(fx * inner_w)), margin + int(round(fy * inner_h))


# ── cv2-backed rendering ─────────────────────────────────────────────────────────
class MatchAnnotator:
    """Draw player boxes, labels and a pitch minimap onto broadcast frames."""

    def __init__(
        self,
        frame_w: int,
        frame_h: int,
        *,
        team_colors: Optional[Sequence[Sequence[int]]] = None,
        minimap: bool = True,
    ) -> None:
        import cv2  # lazy
        self.cv2 = cv2
        self.frame_w, self.frame_h = int(frame_w), int(frame_h)
        self.team_colors = team_colors
        self.minimap = minimap
        self.map_w = max(120, self.frame_w // 6)
        self.map_h = max(1, int(self.map_w * (PITCH_H_M / PITCH_W_M)))

    def annotate(
        self,
        frame,
        tracks,
        *,
        teams: Optional[Dict[int, Optional[int]]] = None,
        speeds: Optional[Dict[int, float]] = None,
        jerseys: Optional[Dict[int, Optional[int]]] = None,
        feet_m: Optional[Dict[int, Tuple[float, float]]] = None,
    ):
        """Return a new annotated frame (the input is not mutated)."""
        cv2 = self.cv2
        teams, speeds, jerseys, feet_m = teams or {}, speeds or {}, jerseys or {}, feet_m or {}
        out = frame.copy()
        dots: List[Tuple[Tuple[float, float], BGR]] = []

        for tr in tracks:
            x1, y1, x2, y2 = (int(v) for v in tr.bbox)
            color = team_color_bgr(teams.get(tr.track_id), self.team_colors)
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)

            caption = box_caption(tr.track_id, jersey=jerseys.get(tr.track_id), speed_kmh=speeds.get(tr.track_id))
            (tw, th), _ = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(out, (x1, y1 - th - 8), (x1 + tw + 6, y1), color, -1)
            cv2.putText(out, caption, (x1 + 3, y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

            foot = feet_m.get(tr.track_id)
            if foot is not None:
                dots.append((foot, color))

        if self.minimap:
            self._draw_minimap(out, dots)
        return out

    def _draw_minimap(self, frame, dots: List[Tuple[Tuple[float, float], BGR]]) -> None:
        cv2 = self.cv2
        mw, mh = self.map_w, self.map_h
        h, w = frame.shape[:2]
        x0, y0 = w - mw - 10, h - mh - 10
        if x0 < 0 or y0 < 0:
            return

        # Semi-transparent pitch panel.
        overlay = frame.copy()
        cv2.rectangle(overlay, (x0, y0), (x0 + mw, y0 + mh), (40, 90, 40), -1)
        cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
        # Pitch markings.
        cv2.rectangle(frame, (x0, y0), (x0 + mw, y0 + mh), (230, 230, 230), 1)
        cv2.line(frame, (x0 + mw // 2, y0), (x0 + mw // 2, y0 + mh), (230, 230, 230), 1)
        cv2.circle(frame, (x0 + mw // 2, y0 + mh // 2), max(6, mh // 6), (230, 230, 230), 1)
        # Players.
        for (xm, ym), color in dots:
            px, py = pitch_to_minimap(xm, ym, mw, mh)
            cv2.circle(frame, (x0 + px, y0 + py), 3, color, -1)
            cv2.circle(frame, (x0 + px, y0 + py), 3, (20, 20, 20), 1)


class VideoSink:
    """Lazy cv2.VideoWriter wrapper with a context-manager lifecycle."""

    def __init__(
        self,
        path: str,
        fps: float,
        frame_size: Tuple[int, int],
        *,
        fourcc: str = "mp4v",
    ) -> None:
        import cv2  # lazy
        self.cv2 = cv2
        self.path = str(path)
        self.fps = float(fps) if fps and fps > 0 else 25.0
        self.frame_size = (int(frame_size[0]), int(frame_size[1]))
        self.fourcc = fourcc
        self._writer = None
        self.frames_written = 0

    def open(self) -> "VideoSink":
        if self._writer is None:
            cc = self.cv2.VideoWriter_fourcc(*self.fourcc)
            self._writer = self.cv2.VideoWriter(self.path, cc, self.fps, self.frame_size)
            if not self._writer.isOpened():
                raise RuntimeError(f"Could not open VideoWriter for {self.path} ({self.fourcc})")
        return self

    def write(self, frame) -> None:
        if self._writer is None:
            self.open()
        self._writer.write(frame)
        self.frames_written += 1

    def release(self) -> None:
        if self._writer is not None:
            self._writer.release()
            self._writer = None

    def __enter__(self) -> "VideoSink":
        return self.open()

    def __exit__(self, *exc) -> None:
        self.release()
