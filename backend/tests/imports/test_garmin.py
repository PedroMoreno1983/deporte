"""Garmin .fit logic.

A real .fit is a binary we can't synthesise without an encoder, so we test the
two pieces of genuine computation directly: distance-band integration / sprint
counting from the per-sample speed stream, and RMSSD from R-R intervals.
"""
from datetime import date

from app.imports.garmin import _distance_bands, _rmssd_ms


class _FakeHrv:
    def __init__(self, rr_seconds):
        self._rr = rr_seconds

    def get_value(self, key):
        return self._rr if key == "time" else None


def test_distance_bands_and_sprint_count():
    # 1 Hz samples (elapsed_s, speed_mps, date). 8.0 m/s = 28.8 km/h (sprint),
    # 2.0 m/s = 7.2 km/h (walk). Two separate sprint efforts.
    d = date(2026, 5, 20)
    samples = [
        (0, 2.0, d), (1, 8.0, d), (2, 8.0, d),
        (3, 2.0, d), (4, 8.0, d), (5, 2.0, d),
    ]
    bands = _distance_bands(samples)
    assert bands["sprint_count"] == 2
    assert round(bands["total_m"], 1) == 28.0
    assert round(bands["hir_m"], 1) == 24.0     # >19.8 km/h samples
    assert round(bands["sprint_m"], 1) == 24.0  # >25.2 km/h samples
    assert bands["max_speed_mps"] == 8.0


def test_distance_bands_ignores_long_gaps():
    d = date(2026, 5, 20)
    # A 600 s gap (auto-pause) must not integrate a huge phantom distance.
    samples = [(0, 8.0, d), (600, 8.0, d), (601, 8.0, d)]
    bands = _distance_bands(samples)
    assert round(bands["total_m"], 1) == 8.0    # only the 600→601 step counts


def test_rmssd_from_rr_intervals():
    # R-R (s): 0.80, 0.82, 0.79, 0.81 → ms diffs 20, -30, 20.
    # RMSSD = sqrt((400+900+400)/3) = 23.8 ms.
    rmssd = _rmssd_ms([_FakeHrv([0.80, 0.82, 0.79, 0.81])])
    assert rmssd == 23.8


def test_rmssd_filters_sentinels():
    # 65.535 s sentinels and None padding must be ignored.
    rmssd = _rmssd_ms([_FakeHrv([0.80, 65.535, None, 0.82, 0.79, 0.81])])
    assert rmssd == 23.8


def test_rmssd_insufficient_data():
    assert _rmssd_ms([_FakeHrv([0.80])]) is None
    assert _rmssd_ms([]) is None
