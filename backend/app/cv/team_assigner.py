"""K-means team assignment based on jersey colour.

Algorithm (from Zepeda / Tarek):
  1. For each player crop, isolate the upper half (torso → jersey).
  2. Run K-means(k=2) on the pixel colours to extract the dominant jersey RGB.
  3. Across the first N frames, gather one dominant colour per player.
  4. Run K-means(k=2) on those dominant colours → two team centroids.
  5. For new frames, classify a player's dominant colour by nearest centroid.

Refs: scikit-learn KMeans, OpenCV BGR pixel access. Numpy only (no torch).
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np


class TeamAssigner:
    def __init__(self) -> None:
        self.team_colors: Dict[int, np.ndarray] = {}   # team_id (0|1) → BGR
        self._cache: Dict[int, int] = {}                # track_id → team_id
        self._fitted: bool = False

    # ── per-player jersey colour ──────────────────────────────────
    @staticmethod
    def _dominant_color(crop_bgr: np.ndarray) -> np.ndarray:
        """Return the dominant non-grass colour of an upper-half crop."""
        from sklearn.cluster import KMeans

        if crop_bgr is None or crop_bgr.size == 0:
            return np.array([128, 128, 128], dtype=float)
        h, w = crop_bgr.shape[:2]
        # Upper half = jersey
        top = crop_bgr[: max(1, h // 2), :, :].reshape(-1, 3).astype(float)
        if top.shape[0] < 4:
            return top.mean(axis=0) if top.size else np.array([128, 128, 128], dtype=float)
        km = KMeans(n_clusters=2, n_init=4, random_state=42).fit(top)
        # Cluster with most samples in the corners (top-left/top-right/bottom-left/bottom-right of the crop)
        # is the background — keep the other.
        labels = km.predict(np.array([
            top[0], top[-1],
            top[len(top) // 4], top[(len(top) * 3) // 4],
        ]))
        background_label = int(np.bincount(labels).argmax())
        player_label = 1 - background_label
        return km.cluster_centers_[player_label]

    # ── team fit (call once with enough crops) ────────────────────
    def fit(self, player_crops: List[np.ndarray]) -> None:
        from sklearn.cluster import KMeans

        if not player_crops:
            return
        colours = np.array([self._dominant_color(c) for c in player_crops])
        if len(colours) < 2:
            self.team_colors[0] = colours[0]
            self.team_colors[1] = colours[0]
            self._fitted = True
            return
        km = KMeans(n_clusters=2, n_init=4, random_state=42).fit(colours)
        self.team_colors[0] = km.cluster_centers_[0]
        self.team_colors[1] = km.cluster_centers_[1]
        self._fitted = True

    # ── assign / cache ────────────────────────────────────────────
    def assign(self, track_id: int, crop_bgr: np.ndarray) -> Optional[int]:
        if not self._fitted:
            return None
        if track_id in self._cache:
            return self._cache[track_id]
        colour = self._dominant_color(crop_bgr)
        d0 = float(np.linalg.norm(colour - self.team_colors[0]))
        d1 = float(np.linalg.norm(colour - self.team_colors[1]))
        team = 0 if d0 < d1 else 1
        self._cache[track_id] = team
        return team

    def colours(self) -> List[Tuple[int, int, int]]:
        """Returns hex/BGR tuples for both teams (for downstream rendering)."""
        return [
            tuple(map(int, self.team_colors.get(0, np.array([0, 255, 135])))),
            tuple(map(int, self.team_colors.get(1, np.array([233, 165, 14])))),
        ]

    # ── convenience accessors used by the annotated-frame writer ─────
    def team_of(self, track_id: int) -> Optional[int]:
        return self._cache.get(track_id)

    def team_color_bgr(self, team_idx: int) -> Tuple[int, int, int]:
        c = self.team_colors.get(team_idx)
        if c is None:
            return (0, 255, 135) if team_idx == 0 else (233, 165, 14)
        return (int(c[0]), int(c[1]), int(c[2]))
