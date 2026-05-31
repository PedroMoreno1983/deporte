"""YOLO-based detector with lazy import so the API boots without ultralytics.

The detector resolves its *class schema* at load time from the checkpoint's own
``names`` (or an override passed by the loader), so downstream code never keys
off raw COCO ids — see :mod:`app.cv.labels`. Use :func:`app.cv.model_loader.load_detector`
to construct one with checkpoint resolution; the bare constructor is fine when
you already know the weights.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .labels import ClassSchema

# Default checkpoint used when constructed directly without the loader.
# Override with env DEPORTE_YOLO_CKPT to point to a fine-tuned model.
DEFAULT_CKPT = os.getenv("DEPORTE_YOLO_CKPT", "yolov8n.pt")

# COCO class indices, kept for backward-compat / direct callers. The schema is
# the authoritative source at runtime; a fine-tuned model overrides these with
# dedicated player/goalkeeper/referee/ball classes.
PERSON_CLASSES = {0}
BALL_CLASSES   = {32}


@dataclass
class Detection:
    bbox:    tuple[float, float, float, float]  # x1, y1, x2, y2
    cls:     int
    score:   float


class YoloDetector:
    """Thin wrapper over `ultralytics.YOLO` that also exposes a class schema."""

    def __init__(
        self,
        weights: str = DEFAULT_CKPT,
        device: Optional[str] = None,
        class_names: Optional[Dict[int, str]] = None,
    ) -> None:
        from ultralytics import YOLO  # lazy
        self.model = YOLO(weights)
        if device:
            self.model.to(device)

        # Prefer an explicit override (e.g. from a checkpoint sidecar); otherwise
        # read the names the model itself carries. Fall back to the COCO view so
        # a names-less model still tracks people.
        names = class_names if class_names else getattr(self.model, "names", None)
        self.schema: ClassSchema = (
            ClassSchema.from_names(names) if names else ClassSchema.coco_default()
        )

    @property
    def names(self) -> Dict[int, str]:
        return dict(self.schema.names)

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
