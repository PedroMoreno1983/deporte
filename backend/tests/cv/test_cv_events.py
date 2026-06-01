"""High-intensity events: sprint / accel / decel / change-of-direction.

Pure-python kinematics, so the whole suite runs in the dev venv. Each test
feeds a synthetic pitch trajectory (metres vs seconds) and asserts the events a
coach would expect — and, just as importantly, the *absence* of events the
detector should not invent (slow jog, smooth running, tracker teleports).
"""
from __future__ import annotations

from app.cv.events import EventDetector, Event, _angle_diff
import math


def _feed(det: EventDetector, track_id, points):
    """points = iterable of (t, x_m, y_m)."""
    for t, x, y in points:
        det.update(track_id, x, y, t)


def _line(v_ms, t0=0.0, t1=2.0, dt=0.1, heading_xy=(1.0, 0.0)):
    """Straight-line constant-speed trajectory at v_ms along a unit heading."""
    hx, hy = heading_xy
    pts, t = [], t0
    n = int(round((t1 - t0) / dt)) + 1
    for i in range(n):
        t = round(t0 + i * dt, 6)
        pts.append((t, v_ms * (t - t0) * hx, v_ms * (t - t0) * hy))
    return pts


# ── helpers ───────────────────────────────────────────────────────────────────
def test_angle_diff_wraps():
    assert abs(_angle_diff(math.radians(10), math.radians(350)) - math.radians(20)) < 1e-9
    assert abs(_angle_diff(0.0, 0.0)) < 1e-9
    assert abs(abs(_angle_diff(math.pi, 0.0)) - math.pi) < 1e-9


def test_event_to_dict_omits_zero_fields():
    d = Event("sprint", 0.0, 1.0, 1.0, peak_speed_kmh=26.0, distance_m=7.0).to_dict()
    assert d == {"kind": "sprint", "start_t": 0.0, "end_t": 1.0,
                 "duration_s": 1.0, "peak_speed_kmh": 26.0, "distance_m": 7.0}
    assert "peak_accel_ms2" not in d and "turn_deg" not in d


# ── sprints ─────────────────────────────────────────────────────────────────────
def test_detects_a_sustained_sprint():
    det = EventDetector(sprint_kmh=20.0, min_sprint_s=0.5)
    _feed(det, 1, _line(7.0, t1=2.0))          # 7 m/s = 25.2 km/h > 20
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["sprints"] == 1
    assert s["top_speed_kmh"] == 25.2
    assert abs(s["sprint_distance_m"] - 14.0) <= 1.0   # ~7 m/s × 2 s
    ev = next(e for e in s["events"] if e["kind"] == "sprint")
    assert ev["peak_speed_kmh"] == 25.2
    assert ev["duration_s"] >= 1.5


def test_no_sprint_below_threshold():
    det = EventDetector(sprint_kmh=20.0)
    _feed(det, 1, _line(3.0, t1=2.0))          # 10.8 km/h — a jog
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["sprints"] == 0


def test_short_burst_is_not_a_sprint():
    det = EventDetector(sprint_kmh=20.0, min_sprint_s=0.5)
    _feed(det, 1, _line(7.0, t1=0.3))          # only 0.3 s above threshold
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["sprints"] == 0


# ── acceleration / deceleration ──────────────────────────────────────────────────
def test_detects_acceleration_burst():
    # x = 2.5 t²  → constant +5 m/s² (well over the 2.5 threshold)
    det = EventDetector(accel_ms2=2.5, min_accel_s=0.3)
    pts = [(round(0.1 * i, 6), 2.5 * (0.1 * i) ** 2, 0.0) for i in range(21)]  # 0..2.0 s
    _feed(det, 1, pts)
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["accelerations"] >= 1
    assert s["decelerations"] == 0
    ev = next(e for e in s["events"] if e["kind"] == "acceleration")
    assert ev["peak_accel_ms2"] >= 4.0


def test_detects_deceleration_burst_without_false_sprint():
    # x = 5 t − 2.5 t²  → start 5 m/s (18 km/h, below sprint), brake at −5 m/s²
    det = EventDetector(sprint_kmh=20.0, accel_ms2=2.5, min_accel_s=0.3)
    pts = [(round(0.1 * i, 6), 5 * (0.1 * i) - 2.5 * (0.1 * i) ** 2, 0.0) for i in range(11)]  # 0..1.0 s
    _feed(det, 1, pts)
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["decelerations"] >= 1
    assert s["sprints"] == 0
    ev = next(e for e in s["events"] if e["kind"] == "deceleration")
    assert ev["peak_accel_ms2"] <= -4.0


def test_smooth_constant_run_has_no_accel_events():
    det = EventDetector(accel_ms2=2.5)
    _feed(det, 1, _line(4.0, t1=2.0))          # constant speed → ~0 accel
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["accelerations"] == 0
    assert s["decelerations"] == 0


# ── change of direction ──────────────────────────────────────────────────────────
def test_detects_sharp_direction_change():
    det = EventDetector(cod_angle_deg=60.0, cod_min_kmh=10.0, sprint_kmh=20.0)
    # Move +x at 5 m/s for 0.5 s, then turn 90° to +y at 5 m/s.
    pts = [(round(0.1 * i, 6), 0.5 * i, 0.0) for i in range(6)]          # t=0.0..0.5
    pts += [(round(0.5 + 0.1 * i, 6), 2.5, 0.5 * i) for i in range(1, 6)]  # t=0.6..1.0
    _feed(det, 1, pts)
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["direction_changes"] == 1
    assert s["sprints"] == 0
    assert s["accelerations"] == 0 and s["decelerations"] == 0
    ev = next(e for e in s["events"] if e["kind"] == "direction_change")
    assert 80.0 <= ev["turn_deg"] <= 100.0


def test_gentle_curve_is_not_a_direction_change():
    det = EventDetector(cod_angle_deg=60.0, cod_min_kmh=10.0)
    # Heading drifts a few degrees per frame — never a sharp turn.
    pts, x, y, hdg = [], 0.0, 0.0, 0.0
    for i in range(20):
        hdg += math.radians(5)          # 5°/frame, always < 60° between frames
        x += 0.5 * math.cos(hdg)
        y += 0.5 * math.sin(hdg)
        pts.append((round(0.1 * i, 6), x, y))
    _feed(det, 1, pts)
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["direction_changes"] == 0


# ── robustness ────────────────────────────────────────────────────────────────────
def test_tracker_teleport_is_ignored():
    det = EventDetector(sprint_kmh=20.0)
    # One absurd jump (id swap): 100 m in 0.1 s = 1000 m/s.
    _feed(det, 1, [(0.0, 0.0, 0.0), (0.1, 100.0, 0.0), (0.2, 100.5, 0.0)])
    s = next(r for r in det.summary() if r["track_id"] == 1)
    assert s["top_speed_kmh"] < 43.0          # never recorded the teleport speed
    assert s["sprints"] == 0


def test_summary_is_idempotent():
    det = EventDetector(sprint_kmh=20.0)
    _feed(det, 1, _line(7.0, t1=2.0))
    first = det.summary()
    second = det.summary()                     # finalize() must not double-count
    assert first[0]["sprints"] == second[0]["sprints"] == 1
    assert len(first[0]["events"]) == len(second[0]["events"])


def test_unfed_detector_summary_empty():
    assert EventDetector().summary() == []
