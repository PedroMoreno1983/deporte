"""Jersey-number recognition for tracked players.

Single-frame OCR of a number on a moving, low-res, motion-blurred shirt is
noisy — one frame might read "8", the next "3", the next nothing. The reliable
signal comes from **aggregating across frames**: a track seen for 200 frames
votes 60× for "8" and 5× for "3", and "8" wins decisively.

So this module is two cleanly separated pieces:

* :class:`JerseyReader` — the *only* part that needs EasyOCR. Wraps the reader,
  constrains it to digits, and maps raw text to plausible jersey numbers. Lazy
  import so the pipeline runs (without numbers) when EasyOCR isn't installed.
* :class:`JerseyVoter` — confidence-weighted voting across a track's lifetime.
  Pure-python; this is where the noise-rejection lives and it's fully unit
  tested without any heavy dependency.

Plus :func:`torso_crop`, which isolates the shirt region of a player box so the
reader sees the number and not the head/legs/background.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger("cv.jersey_ocr")

# Jersey numbers are 0-99 in practice (a handful of leagues allow up to 99 only).
MAX_JERSEY_NUMBER = 99
DIGIT_ALLOWLIST = "0123456789"


def plausible_jersey_number(text: Any, *, max_number: int = MAX_JERSEY_NUMBER) -> Optional[int]:
    """Map a raw OCR string to a jersey number, or ``None`` if implausible.

    Keeps only digits, rejects anything longer than ``max_number`` has digits
    (so "100"/"1234" are dropped), and bounds the value to ``[0, max_number]``.
    """
    digits = "".join(ch for ch in str(text) if ch.isdigit())
    if not digits or len(digits) > len(str(max_number)):
        return None
    n = int(digits)
    if n < 0 or n > max_number:
        return None
    return n


def torso_crop(
    frame: Any,
    bbox: Tuple[float, float, float, float],
    *,
    top: float = 0.15,
    bottom: float = 0.55,
    side: float = 0.18,
) -> Optional[Any]:
    """Return the central-upper region of a player box (where the number sits).

    Defaults trim the head (top 15%), the legs (below 55%) and the arms/edges
    (18% off each side), focusing the reader on the shirt. Returns ``None`` if
    the resulting crop is empty. Works on any HxWxC array (numpy); no heavy
    import here.
    """
    x1, y1, x2, y2 = bbox
    w = x2 - x1
    h = y2 - y1
    if w <= 0 or h <= 0:
        return None
    cx1 = int(x1 + side * w)
    cx2 = int(x2 - side * w)
    cy1 = int(y1 + top * h)
    cy2 = int(y1 + bottom * h)

    H, W = frame.shape[:2]
    cx1, cy1 = max(0, cx1), max(0, cy1)
    cx2, cy2 = min(W, cx2), min(H, cy2)
    if cx2 <= cx1 or cy2 <= cy1:
        return None
    return frame[cy1:cy2, cx1:cx2]


class JerseyReader:
    """EasyOCR wrapper constrained to reading jersey numbers (digits only)."""

    def __init__(self, languages=("en",), gpu: bool = False, allowlist: str = DIGIT_ALLOWLIST) -> None:
        import easyocr  # lazy: pulls torch
        self._reader = easyocr.Reader(list(languages), gpu=gpu, verbose=False)
        self._allowlist = allowlist

    @staticmethod
    def available() -> bool:
        import importlib.util
        return importlib.util.find_spec("easyocr") is not None

    def read(
        self,
        crop_bgr: Any,
        *,
        min_confidence: float = 0.2,
        max_number: int = MAX_JERSEY_NUMBER,
    ) -> List[Tuple[int, float]]:
        """OCR a crop → list of ``(number, confidence)`` plausible readings."""
        if crop_bgr is None or getattr(crop_bgr, "size", 0) == 0:
            return []
        try:
            raw = self._reader.readtext(crop_bgr, allowlist=self._allowlist)
        except Exception as exc:  # noqa: BLE001 — OCR must never crash the pipeline
            log.debug("OCR readtext failed on a crop: %s", exc)
            return []
        out: List[Tuple[int, float]] = []
        for _box, text, conf in raw:
            n = plausible_jersey_number(text, max_number=max_number)
            if n is not None and float(conf) >= min_confidence:
                out.append((n, float(conf)))
        return out


@dataclass
class _Tally:
    weight: Dict[int, float] = field(default_factory=lambda: defaultdict(float))  # number → Σ confidence
    count: Dict[int, int] = field(default_factory=lambda: defaultdict(int))       # number → times seen


class JerseyVoter:
    """Confidence-weighted voting that resolves one number per track.

    Each OCR reading is a vote weighted by its confidence. A number is only
    *resolved* once a track has enough total votes, sufficient average
    confidence for the winner, and the winner commands a high-enough share of
    all votes — three guards that together reject the inevitable single-frame
    misreads.
    """

    def __init__(
        self,
        *,
        min_votes: int = 3,
        min_confidence: float = 0.35,
        min_agreement: float = 0.5,
    ) -> None:
        self.min_votes = min_votes
        self.min_confidence = min_confidence
        self.min_agreement = min_agreement
        self._tracks: Dict[int, _Tally] = defaultdict(_Tally)

    def update(self, track_id: int, number: int, confidence: float) -> None:
        t = self._tracks[int(track_id)]
        t.weight[int(number)] += float(confidence)
        t.count[int(number)] += 1

    def resolve(self, track_id: int) -> Optional[Dict[str, float]]:
        """Best number for a track, or ``None`` if the evidence is too weak."""
        t = self._tracks.get(int(track_id))
        if not t or not t.count:
            return None
        total_votes = sum(t.count.values())
        if total_votes < self.min_votes:
            return None
        # Winner by summed confidence (not raw count): a few high-confidence
        # reads should outweigh many low-confidence ones.
        best = max(t.weight, key=lambda n: t.weight[n])
        best_votes = t.count[best]
        avg_conf = t.weight[best] / best_votes
        agreement = best_votes / total_votes
        if avg_conf < self.min_confidence or agreement < self.min_agreement:
            return None
        return {
            "number": int(best),
            "confidence": round(avg_conf, 3),
            "votes": int(best_votes),
            "agreement": round(agreement, 3),
        }

    def snapshot(self) -> Dict[int, Dict[str, float]]:
        """Resolved numbers for every track that clears the thresholds."""
        out: Dict[int, Dict[str, float]] = {}
        for tid in self._tracks:
            resolved = self.resolve(tid)
            if resolved is not None:
                out[tid] = resolved
        return out
