"""Appearance ReID: colour-histogram embedding + identity-gallery matching.

All pure NumPy (no torch/cv2), so the whole suite runs in the dev venv. The
gallery's job is to merge *fragments of one player* while never merging two
*distinct* players — both directions are covered, including the active-track
exclusion that stops two players on screen at once from collapsing into one
identity.
"""
from __future__ import annotations

import numpy as np
import pytest

from app.cv.reid import (
    ColorHistogramEmbedder,
    Identity,
    ReIDGallery,
    cosine_similarity,
    l2_normalize,
)


def _solid(color, h: int = 48, w: int = 24) -> np.ndarray:
    """A solid (H, W, 3) uint8 crop of one colour."""
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:, :] = color
    return img


RED  = (255, 0, 0)
BLUE = (0, 0, 255)


# ── vector helpers ────────────────────────────────────────────────────────────
def test_l2_normalize_unit_norm_and_zero_safe():
    v = l2_normalize(np.array([3.0, 4.0]))
    assert abs(float(np.linalg.norm(v)) - 1.0) < 1e-9
    assert v[0] == 0.6 and v[1] == 0.8
    # zero vector returned unchanged (no divide-by-zero)
    z = l2_normalize(np.zeros(4))
    assert np.allclose(z, 0.0)


def test_cosine_similarity_basics():
    a = np.array([1.0, 0.0, 0.0])
    b = np.array([0.0, 1.0, 0.0])
    assert cosine_similarity(a, a) == 1.0
    assert cosine_similarity(a, b) == 0.0          # orthogonal
    assert cosine_similarity(a, None) == 0.0       # missing operand
    assert cosine_similarity(np.zeros(3), a) == 0.0  # zero vector


# ── embedding ─────────────────────────────────────────────────────────────────
def test_embedder_dim_and_unit_norm():
    emb = ColorHistogramEmbedder(bins=16)
    v = emb.embed(_solid(RED))
    assert v is not None
    assert v.shape == (48,)                         # 3 channels × 16 bins
    assert abs(float(np.linalg.norm(v)) - 1.0) < 1e-9


def test_embedder_discriminates_colours():
    emb = ColorHistogramEmbedder()
    red, red2, blue = emb.embed(_solid(RED)), emb.embed(_solid(RED)), emb.embed(_solid(BLUE))
    # identical colour → identical embedding
    assert cosine_similarity(red, red2) == pytest.approx(1.0)
    # different colour → clearly lower similarity, well under the gallery threshold
    rb = cosine_similarity(red, blue)
    assert rb < 0.5
    assert rb < cosine_similarity(red, red2)


def test_embedder_rejects_unusable_crops():
    emb = ColorHistogramEmbedder()
    assert emb.embed(None) is None
    assert emb.embed(np.zeros((0, 0, 3), dtype=np.uint8)) is None
    assert emb.embed(np.zeros((10, 10), dtype=np.uint8)) is None   # not 3-channel


# ── gallery: re-identification across a gap ─────────────────────────────────────
def test_gallery_reid_after_track_break():
    emb = ColorHistogramEmbedder()
    g = ReIDGallery(threshold=0.6)
    red = emb.embed(_solid(RED))

    id_a = g.assign(track_id=1, embedding=red, frame_idx=0)
    # Track 1 disappears; a new ByteTrack id 2 appears later with the same look.
    id_b = g.assign(track_id=2, embedding=emb.embed(_solid(RED)), frame_idx=5)

    assert id_a == id_b                              # merged into one player
    assert g.groups()[id_a] == [1, 2]
    assert g.snapshot() == {1: id_a, 2: id_a}


def test_gallery_dissimilar_appearance_starts_new_identity():
    emb = ColorHistogramEmbedder()
    g = ReIDGallery(threshold=0.6)
    id_a = g.assign(1, emb.embed(_solid(RED)), 0)
    id_b = g.assign(2, emb.embed(_solid(BLUE)), 5)   # different colour → new player
    assert id_a != id_b


def test_gallery_active_track_exclusion():
    # Two identical-looking players on screen in the SAME frame must NOT collapse.
    emb = ColorHistogramEmbedder()
    g = ReIDGallery(threshold=0.6)
    red = emb.embed(_solid(RED))
    id_a = g.assign(1, red, frame_idx=0)
    id_b = g.assign(2, emb.embed(_solid(RED)), frame_idx=0)   # same frame
    assert id_a != id_b
    assert set(g.groups().keys()) == {id_a, id_b}


def test_gallery_respects_max_idle_horizon():
    emb = ColorHistogramEmbedder()
    g = ReIDGallery(threshold=0.6, max_idle=10)
    red = emb.embed(_solid(RED))
    id_a = g.assign(1, red, frame_idx=0)
    # Reappears far beyond the re-id horizon → treated as a new player.
    id_b = g.assign(2, emb.embed(_solid(RED)), frame_idx=100)
    assert id_a != id_b


def test_gallery_mapped_track_keeps_identity_and_emas_appearance():
    emb = ColorHistogramEmbedder()
    g = ReIDGallery(threshold=0.6, ema=0.7)
    red, blue = emb.embed(_solid(RED)), emb.embed(_solid(BLUE))

    id_a = g.assign(1, red, 0)
    id_again = g.assign(1, blue, 1)                  # same track id, new look
    assert id_again == id_a                          # identity is sticky per track

    stored = g.identities[id_a].embedding
    assert abs(float(np.linalg.norm(stored)) - 1.0) < 1e-9      # still unit-norm
    assert not np.allclose(stored, red)              # moved off the pure-red anchor
    # EMA keeps 0.7 weight on red, so it stays closer to red than to blue.
    assert cosine_similarity(stored, red) > cosine_similarity(stored, blue)


def test_gallery_none_embedding_track_gets_own_identity():
    g = ReIDGallery()
    id_a = g.assign(1, None, 0)                       # unusable crop → still tracked
    assert g.identity_of(1) == id_a
    assert g.identities[id_a].embedding is None


def test_gallery_identity_of_unknown_track_is_none():
    assert ReIDGallery().identity_of(999) is None


def test_identity_dataclass_defaults():
    idn = Identity(embedding=None, last_frame=3)
    assert idn.active_track is None
    assert idn.track_ids == set()
