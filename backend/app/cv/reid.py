"""Appearance-based re-identification (ReID) to merge fragmented tracks.

ByteTrack assigns a *new* track id whenever a player is occluded, leaves the
frame, or is missed for a few frames and then reappears. Left alone, that
fragments one player's stats across several ids. This module re-associates the
fragments by torso *appearance*: a cheap per-channel colour histogram (pure
NumPy — no torch, no extra dependency, matching Path C's low-cost mandate) is
embedded per track and matched against a gallery of known identities by cosine
similarity.

It is deliberately conservative. A colour histogram cannot separate two players
on the *same* team as reliably as a deep ReID network would, and the costly
error is **merging distinct players** (it silently corrupts every per-player
stat). So the gallery is tuned to avoid that: a high similarity threshold, plus
an *active-track exclusion* that refuses to match a new track to any identity
already on screen this frame. Combined with the cross-frame jersey-number
voting in ``jersey_ocr.py`` this yields a stable per-player identity for youth /
lower-division footage without a GPU.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

import numpy as np


# ── vector helpers ──────────────────────────────────────────────────────────────
def l2_normalize(v: np.ndarray) -> np.ndarray:
    """Return ``v`` scaled to unit L2 norm; a (near-)zero vector is unchanged."""
    v = np.asarray(v, dtype=float)
    n = float(np.linalg.norm(v))
    if n <= 1e-12:
        return v
    return v / n


def cosine_similarity(a: Optional[np.ndarray], b: Optional[np.ndarray]) -> float:
    """Cosine similarity in [-1, 1]; 0.0 if either vector is missing or zero."""
    if a is None or b is None:
        return 0.0
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na <= 1e-12 or nb <= 1e-12:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ── appearance embedding ──────────────────────────────────────────────────────────
class ColorHistogramEmbedder:
    """Embed a player crop as concatenated per-channel colour histograms.

    The crop is an ``(H, W, 3)`` uint8 image. The embedder is channel-order
    agnostic (BGR or RGB) — it only needs the *same* order on every call. To
    emphasise the jersey/shorts and suppress grass and the bounding box's
    background corners, only a central, upper-body sub-region is sampled. The
    output is L2-normalised, so cosine similarity reduces to a dot product.
    """

    def __init__(
        self,
        bins: int = 16,
        *,
        top: float = 0.10,
        bottom: float = 0.75,
        side: float = 0.15,
    ) -> None:
        self.bins = int(bins)
        self.top = float(top)
        self.bottom = float(bottom)
        self.side = float(side)

    @property
    def dim(self) -> int:
        return 3 * self.bins

    def _focus(self, crop: np.ndarray) -> np.ndarray:
        """Central upper-body sub-region; falls back to the full crop if degenerate."""
        h, w = crop.shape[:2]
        y1, y2 = int(h * self.top), int(h * self.bottom)
        x1, x2 = int(w * self.side), int(w * (1.0 - self.side))
        if y2 <= y1 or x2 <= x1:
            return crop
        return crop[y1:y2, x1:x2]

    def embed(self, crop: Optional[np.ndarray]) -> Optional[np.ndarray]:
        """Return a unit-norm appearance vector, or None for an unusable crop."""
        if crop is None:
            return None
        arr = np.asarray(crop)
        if arr.size == 0 or arr.ndim != 3 or arr.shape[2] < 3:
            return None
        region = self._focus(arr)
        if region.size == 0:
            return None
        feats: List[np.ndarray] = []
        for ch in range(3):
            hist, _ = np.histogram(region[:, :, ch], bins=self.bins, range=(0, 256))
            total = float(hist.sum())
            feats.append(hist / total if total > 0 else hist.astype(float))
        return l2_normalize(np.concatenate(feats))


# ── identity gallery ──────────────────────────────────────────────────────────────
@dataclass
class Identity:
    embedding:    Optional[np.ndarray]
    last_frame:   int
    active_track: Optional[int] = None
    track_ids:    Set[int] = field(default_factory=set)


class ReIDGallery:
    """Match per-track appearance embeddings to a growing set of identities.

    Parameters
    ----------
    threshold : minimum cosine similarity to re-associate a new track with an
        existing identity. Higher = fewer (but safer) merges.
    ema : weight kept for the stored embedding when blending in a fresh one
        (exponential moving average), smoothing per-frame appearance noise.
    max_idle : an identity idle for more than this many processed frames is no
        longer a re-id candidate (the player is assumed gone for good).
    """

    def __init__(self, *, threshold: float = 0.6, ema: float = 0.7, max_idle: int = 300) -> None:
        self.threshold = float(threshold)
        self.ema = float(ema)
        self.max_idle = int(max_idle)
        self.identities: Dict[int, Identity] = {}
        self.track_to_identity: Dict[int, int] = {}
        self._next_id = 1

    # ── internals ───────────────────────────────────────────────────────────
    def _new_identity(self, track_id: int, embedding: Optional[np.ndarray], frame_idx: int) -> int:
        iid = self._next_id
        self._next_id += 1
        self.identities[iid] = Identity(
            embedding=(None if embedding is None else l2_normalize(embedding)),
            last_frame=frame_idx,
            active_track=track_id,
            track_ids={track_id},
        )
        self.track_to_identity[track_id] = iid
        return iid

    def _touch(self, iid: int, track_id: int, embedding: Optional[np.ndarray], frame_idx: int) -> None:
        idn = self.identities[iid]
        idn.last_frame = frame_idx
        idn.active_track = track_id
        idn.track_ids.add(track_id)
        self.track_to_identity[track_id] = iid
        if embedding is not None:
            emb = l2_normalize(embedding)
            if idn.embedding is None:
                idn.embedding = emb
            else:
                idn.embedding = l2_normalize(self.ema * idn.embedding + (1.0 - self.ema) * emb)

    # ── public API ──────────────────────────────────────────────────────────
    def assign(self, track_id: int, embedding: Optional[np.ndarray], frame_idx: int) -> int:
        """Resolve ``track_id`` to a stable identity id for this frame.

        A track already bound to an identity keeps it (and refreshes appearance
        + recency). An unseen track is matched against *idle* identities by
        appearance; failing that, it starts a new identity.
        """
        iid = self.track_to_identity.get(track_id)
        if iid is not None:
            self._touch(iid, track_id, embedding, frame_idx)
            return iid

        # A new track with no usable appearance can't be matched — start fresh.
        if embedding is None:
            return self._new_identity(track_id, None, frame_idx)

        emb = l2_normalize(embedding)
        best_iid: Optional[int] = None
        best_sim = 0.0
        for cand_id, idn in self.identities.items():
            if idn.embedding is None:
                continue
            # Active-track exclusion: an identity already seen *this* frame is on
            # screen right now, so a different new track cannot be that person.
            if idn.last_frame >= frame_idx:
                continue
            # Drop identities idle beyond the re-id horizon.
            if frame_idx - idn.last_frame > self.max_idle:
                continue
            sim = cosine_similarity(emb, idn.embedding)
            if sim > best_sim:
                best_iid, best_sim = cand_id, sim

        if best_iid is not None and best_sim >= self.threshold:
            self._touch(best_iid, track_id, emb, frame_idx)
            return best_iid
        return self._new_identity(track_id, emb, frame_idx)

    def identity_of(self, track_id: int) -> Optional[int]:
        return self.track_to_identity.get(track_id)

    def groups(self) -> Dict[int, List[int]]:
        """{identity_id: sorted member track_ids}."""
        return {iid: sorted(idn.track_ids) for iid, idn in self.identities.items()}

    def snapshot(self) -> Dict[int, int]:
        """{track_id: identity_id} for every track seen so far."""
        return dict(self.track_to_identity)
