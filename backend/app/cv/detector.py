"""YOLO-based detector with lazy import so the API boots without ultralytics."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, List, Optional


# Default checkpoint used in the original repo.
# Override with env DEPORTE_YOLO_CKPT to point to a fine-tuned model.
DEFAULT_CKPT = os.getenv("DEPORTE_YOLO_CKPT", "yolov8n.pt")

# COCO class indices we care about: person=0, sports ball=32.
# A fine-tuned model will replace these with player/referee/keeper/ball.
PERSON_CLASSES = {0}
BALL_CLASSES   = {32}


@dataclass
class Detection:
    bbox:    tuple[float, float, float, float]  # x1, y1, x2, y2
    cls:     int
    score:   float


class YoloDetector:
    """Thin wrapper over `ultralytics.YOLO`."""

    def __init__(self, weights: str = DEFAULT_CKPT, device: Optional[str] = None) -> None:
        from ultralytics import YOLO  # lazy
        self.model = YOLO(weights)
        if device:
            self.model.to(device)

    def detect(self, frame_bgr: Any, conf: float = 0.25, imgsz: int = 640) -> List[Detection]:
        # imgsz=640 (vs 1280 default) ~2× faster on CPU with marginal recall loss
        # on standard broadcast footage. Override per-call if needed.
        results = self.model.predict(frame_bgr, conf=conf, imgsz=imgsz, verbose=False)
        out: List[Detection] = []
        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                xyxy = box.xyxy[0].cpu().numpy().tolist()
                cls  = int(box.cls[0].item())
                conf_ = float(box.conf[0].item())
                out.append(Detection(bbox=tuple(xyxy), cls=cls, score=conf_))
        return out
