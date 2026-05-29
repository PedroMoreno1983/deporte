"""Per-track speed (km/h) and accumulated distance (m).

Operates on pitch coordinates from `view_transformer.ViewTransformer`. Uses an
EMA over a rolling window to smooth noisy estimates.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Tuple


SMOOTH_WINDOW = 5   # frames


@dataclass
class TrackKinematics:
    distance_m:        float = 0.0
    last_xy:           Tuple[float, float] | None = None
    last_t:            float | None = None
    speed_window:      Deque[float] = field(default_factory=lambda: deque(maxlen=SMOOTH_WINDOW))


class SpeedDistance:
    def __init__(self) -> None:
        self.tracks: Dict[int, TrackKinematics] = {}

    def update(self, track_id: int, x_m: float, y_m: float, t_seconds: float) -> Tuple[float, float]:
        """Update a track with a new pitch position.
        Returns (current_smoothed_speed_kmh, accumulated_distance_m)."""
        k = self.tracks.setdefault(track_id, TrackKinematics())
        if k.last_xy is not None and k.last_t is not None:
            dx = x_m - k.last_xy[0]
            dy = y_m - k.last_xy[1]
            d = (dx * dx + dy * dy) ** 0.5
            dt = max(t_seconds - k.last_t, 1e-6)
            # Plausibility filter: cap at 12 m/s (~43 km/h, ~Bolt territory)
            if d / dt < 12.0:
                k.distance_m += d
                k.speed_window.append((d / dt) * 3.6)
        k.last_xy = (x_m, y_m)
        k.last_t  = t_seconds
        smoothed = sum(k.speed_window) / len(k.speed_window) if k.speed_window else 0.0
        return smoothed, k.distance_m

    def snapshot(self) -> List[Dict[str, float | int]]:
        return [
            {
                "track_id":   tid,
                "distance_m": round(k.distance_m, 1),
                "speed_kmh":  round((sum(k.speed_window) / len(k.speed_window)) if k.speed_window else 0.0, 1),
            }
            for tid, k in self.tracks.items()
        ]
