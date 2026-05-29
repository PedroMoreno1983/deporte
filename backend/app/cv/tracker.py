"""ByteTrack wrapper using `supervision`.

Returns a per-frame list of (track_id, bbox, cls). Stable IDs across frames let
us compute per-player velocity, distance and team consistency.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, List

from .detector import Detection


@dataclass
class Track:
    track_id: int
    bbox:     tuple[float, float, float, float]
    cls:      int


class BoxTracker:
    def __init__(self, fps: float = 25.0) -> None:
        # lazy import
        import supervision as sv
        self.sv = sv
        self.tracker = sv.ByteTrack(frame_rate=int(round(fps)))

    def update(self, detections: List[Detection]) -> List[Track]:
        import numpy as np

        if not detections:
            return []
        xyxy = np.array([d.bbox for d in detections], dtype=float)
        conf = np.array([d.score for d in detections], dtype=float)
        cls  = np.array([d.cls   for d in detections], dtype=int)

        det = self.sv.Detections(xyxy=xyxy, confidence=conf, class_id=cls)
        tracked = self.tracker.update_with_detections(det)

        tracks: List[Track] = []
        for i in range(len(tracked)):
            tid = int(tracked.tracker_id[i]) if tracked.tracker_id is not None else -1
            bbox = tuple(tracked.xyxy[i].tolist())
            c = int(tracked.class_id[i]) if tracked.class_id is not None else 0
            tracks.append(Track(track_id=tid, bbox=bbox, cls=c))
        return tracks
