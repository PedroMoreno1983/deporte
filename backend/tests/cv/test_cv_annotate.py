"""Annotated-video rendering: label/colour/minimap math + cv2 smoke tests.

The pure helpers (no OpenCV) carry the logic and always run. MatchAnnotator and
VideoSink need cv2, so they're skipped where the dep is absent — but when it's
present we prove a frame is actually drawn on (without mutating the input) and a
real .mp4 is written to disk.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.cv.annotate import (
    box_caption,
    pitch_to_minimap,
    player_label,
    speed_label,
    team_color_bgr,
)
from app.cv.view_transformer import PITCH_H_M, PITCH_W_M


def _track(tid, bbox):
    return SimpleNamespace(track_id=tid, bbox=bbox)


# ── colours ─────────────────────────────────────────────────────────────────────
def test_team_color_unknown_is_white():
    assert team_color_bgr(None) == (255, 255, 255)


def test_team_color_uses_fitted_colours_when_present():
    colours = [(10, 20, 30), (40, 50, 60)]
    assert team_color_bgr(0, colours) == (10, 20, 30)
    assert team_color_bgr(1, colours) == (40, 50, 60)


def test_team_color_falls_back_to_defaults():
    c0 = team_color_bgr(0)
    c1 = team_color_bgr(1)
    assert c0 != c1 and len(c0) == 3 and all(0 <= v <= 255 for v in c0)


# ── labels ──────────────────────────────────────────────────────────────────────
def test_player_label_prefers_jersey():
    assert player_label(7, jersey=10) == "#10"
    assert player_label(7) == "t7"
    assert player_label(7, jersey=None) == "t7"


def test_speed_label_hides_zero_and_none():
    assert speed_label(None) == ""
    assert speed_label(0.0) == ""
    assert speed_label(24.3) == "24km/h"


def test_box_caption_combines_label_and_speed():
    assert box_caption(3, jersey=9, speed_kmh=18.6) == "#9 19km/h"
    assert box_caption(3) == "t3"           # nothing to add → just the tag
    assert box_caption(3, jersey=9) == "#9"


# ── minimap coordinates ───────────────────────────────────────────────────────────
def test_minimap_center_maps_near_center():
    px, py = pitch_to_minimap(PITCH_W_M / 2, PITCH_H_M / 2, 100, 64, margin=4)
    assert 46 <= px <= 54
    assert 28 <= py <= 36


def test_minimap_clamps_out_of_bounds():
    # Far negative → top-left margin; far positive → bottom-right margin.
    assert pitch_to_minimap(-50, -50, 100, 64, margin=4) == (4, 4)
    assert pitch_to_minimap(999, 999, 100, 64, margin=4) == (96, 60)


# ── cv2-backed rendering (needs opencv) ───────────────────────────────────────────
def test_annotator_draws_without_mutating_input():
    cv2 = pytest.importorskip("cv2")          # noqa: F841
    np = pytest.importorskip("numpy")
    from app.cv.annotate import MatchAnnotator

    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    tracks = [_track(1, (50, 40, 110, 200)), _track(2, (300, 60, 360, 220))]
    ann = MatchAnnotator(640, 360)
    out = ann.annotate(
        frame, tracks,
        teams={1: 0, 2: 1},
        speeds={1: 22.0, 2: 0.0},
        jerseys={1: 10, 2: None},
        feet_m={1: (20.0, 30.0), 2: (80.0, 40.0)},
    )
    assert out.shape == frame.shape
    assert int(np.count_nonzero(frame)) == 0      # input untouched
    assert int(np.count_nonzero(out)) > 0         # something was drawn


def test_video_sink_writes_a_real_file(tmp_path):
    cv2 = pytest.importorskip("cv2")              # noqa: F841
    np = pytest.importorskip("numpy")
    from app.cv.annotate import VideoSink

    path = tmp_path / "out.mp4"
    with VideoSink(str(path), fps=10.0, frame_size=(64, 48)) as sink:
        for _ in range(3):
            sink.write(np.zeros((48, 64, 3), dtype=np.uint8))
    assert sink.frames_written == 3
    assert path.exists() and path.stat().st_size > 0
