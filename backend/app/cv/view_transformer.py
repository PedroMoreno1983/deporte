"""Perspective transform from camera image → top-down pitch coordinates.

The four source points are the corners of the visible pitch in the broadcast
frame; the four destination points are the corners of a standardised pitch in
metres (105 × 68 by default).

For a one-shot demo, when no calibration is provided we approximate the source
quad as the corners of the frame (effectively no-op). A coach can fine-tune
the source points via the API later.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np


PITCH_W_M = 105.0
PITCH_H_M = 68.0


@dataclass
class CalibrationPoints:
    # 4 image-space points clockwise from top-left of the pitch
    img_quad: Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float], Tuple[float, float]]


class ViewTransformer:
    def __init__(self, frame_w: int, frame_h: int, calibration: Optional[CalibrationPoints] = None) -> None:
        import cv2  # lazy
        self.cv2 = cv2
        self.frame_w, self.frame_h = frame_w, frame_h
        if calibration is None:
            src = np.array([
                (0,            0),
                (frame_w,      0),
                (frame_w, frame_h),
                (0,       frame_h),
            ], dtype=np.float32)
        else:
            src = np.array(calibration.img_quad, dtype=np.float32)
        dst = np.array([
            (0,         0),
            (PITCH_W_M, 0),
            (PITCH_W_M, PITCH_H_M),
            (0,         PITCH_H_M),
        ], dtype=np.float32)
        self.H = cv2.getPerspectiveTransform(src, dst)

    def to_pitch(self, x: float, y: float) -> Tuple[float, float]:
        """Map a single image-space point (x, y) to pitch metres."""
        pt = np.array([[[x, y]]], dtype=np.float32)
        warped = self.cv2.perspectiveTransform(pt, self.H)[0][0]
        return float(warped[0]), float(warped[1])

    @staticmethod
    def bbox_foot_point(bbox: Tuple[float, float, float, float]) -> Tuple[float, float]:
        """Anchor point of a player = middle of bottom bbox edge."""
        x1, y1, x2, y2 = bbox
        return (x1 + x2) / 2.0, y2
