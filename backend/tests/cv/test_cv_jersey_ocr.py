"""Jersey-number OCR: digit parsing, torso cropping, and cross-frame voting.

The voting logic is the part that turns noisy per-frame reads into one stable
number, so it gets the most coverage — and it's pure-python, so it always runs.
The EasyOCR reader itself is smoke-tested only where the dep is installed.
"""
from __future__ import annotations

import pytest

from app.cv.jersey_ocr import JerseyVoter, plausible_jersey_number, torso_crop


# ── digit parsing ─────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "text,expected",
    [
        ("10", 10),
        ("7", 7),
        ("07", 7),          # leading zero → 7
        ("0", 0),           # 0 is a legal number
        ("99", 99),
        ("  23 ", 23),      # surrounding whitespace
        ("#9", 9),          # stray glyphs stripped
        ("1O", 1),          # OCR letter-O dropped, digit '1' kept
    ],
)
def test_plausible_jersey_number_basic(text, expected):
    assert plausible_jersey_number(text) == expected


def test_plausible_rejects_out_of_range_and_nondigits():
    assert plausible_jersey_number("100") is None     # 3 digits > max 99
    assert plausible_jersey_number("1234") is None
    assert plausible_jersey_number("abc") is None
    assert plausible_jersey_number("") is None
    assert plausible_jersey_number(None) is None


def test_plausible_custom_max():
    assert plausible_jersey_number("5", max_number=9) == 5
    assert plausible_jersey_number("23", max_number=9) is None  # 2 digits > max '9'


# ── torso crop (numpy only) ───────────────────────────────────────────────────
def test_torso_crop_isolates_central_upper_region():
    np = pytest.importorskip("numpy")
    frame = np.zeros((200, 100, 3), dtype=np.uint8)
    # bbox covering most of the frame: x1,y1,x2,y2
    crop = torso_crop(frame, (10, 20, 90, 180))
    assert crop is not None
    ch, cw = crop.shape[:2]
    box_h, box_w = 160, 80
    # top=0.15..bottom=0.55 of height, side=0.18 each side of width
    assert abs(ch - int(box_h * (0.55 - 0.15))) <= 2
    assert abs(cw - int(box_w * (1 - 2 * 0.18))) <= 2


def test_torso_crop_clamps_to_frame_and_handles_degenerate():
    np = pytest.importorskip("numpy")
    frame = np.zeros((50, 50, 3), dtype=np.uint8)
    # bbox partly outside the frame — must clamp, not raise.
    crop = torso_crop(frame, (-20, -20, 30, 30))
    assert crop is not None and crop.size > 0
    # zero-area bbox → None
    assert torso_crop(frame, (10, 10, 10, 10)) is None


# ── cross-frame voting ────────────────────────────────────────────────────────
def test_voter_resolves_dominant_number():
    v = JerseyVoter(min_votes=3, min_confidence=0.35, min_agreement=0.5)
    for _ in range(8):
        v.update(track_id=1, number=10, confidence=0.9)
    for _ in range(2):
        v.update(track_id=1, number=16, confidence=0.4)   # minority noise

    res = v.resolve(1)
    assert res is not None
    assert res["number"] == 10
    assert res["votes"] == 8
    assert res["agreement"] == round(8 / 10, 3)
    assert res["confidence"] == 0.9


def test_voter_weights_by_confidence_not_raw_count():
    # "8" seen 5× weakly (0.3 each → 1.5) vs "8?"… use two numbers:
    v = JerseyVoter(min_votes=3, min_confidence=0.3, min_agreement=0.0)
    for _ in range(5):
        v.update(1, 3, 0.30)     # count 5, weight 1.50
    for _ in range(3):
        v.update(1, 8, 0.95)     # count 3, weight 2.85 → should win on weight
    res = v.resolve(1)
    assert res["number"] == 8


def test_voter_withholds_when_evidence_too_weak():
    # Too few votes.
    v = JerseyVoter(min_votes=5)
    v.update(1, 9, 0.9)
    v.update(1, 9, 0.9)
    assert v.resolve(1) is None

    # Enough votes but no clear winner (agreement below threshold).
    v2 = JerseyVoter(min_votes=4, min_confidence=0.1, min_agreement=0.6)
    for n in (1, 2, 3, 4):
        v2.update(2, n, 0.9)     # 4 different numbers, 25% agreement each
    assert v2.resolve(2) is None

    # Enough votes, agreement ok, but confidence too low.
    v3 = JerseyVoter(min_votes=3, min_confidence=0.8, min_agreement=0.5)
    for _ in range(4):
        v3.update(3, 5, 0.4)
    assert v3.resolve(3) is None


def test_voter_unknown_track_is_none():
    assert JerseyVoter().resolve(999) is None


def test_voter_snapshot_only_includes_resolved_tracks():
    v = JerseyVoter(min_votes=3, min_confidence=0.3, min_agreement=0.5)
    for _ in range(5):
        v.update(1, 10, 0.9)          # resolves
    v.update(2, 7, 0.9)               # only 1 vote → withheld
    snap = v.snapshot()
    assert set(snap.keys()) == {1}
    assert snap[1]["number"] == 10


# ── reader smoke (needs easyocr) ──────────────────────────────────────────────
def test_reader_available_flag():
    from app.cv.jersey_ocr import JerseyReader
    assert isinstance(JerseyReader.available(), bool)


def test_reader_reads_a_rendered_number():
    pytest.importorskip("easyocr")
    cv2 = pytest.importorskip("cv2")
    np = pytest.importorskip("numpy")
    from app.cv.jersey_ocr import JerseyReader

    # White canvas with a big black "10".
    img = np.full((120, 120, 3), 255, dtype=np.uint8)
    cv2.putText(img, "10", (20, 90), cv2.FONT_HERSHEY_SIMPLEX, 3.0, (0, 0, 0), 8, cv2.LINE_AA)

    reader = JerseyReader(gpu=False)
    reads = reader.read(img, min_confidence=0.0)
    assert any(num == 10 for num, _conf in reads)
