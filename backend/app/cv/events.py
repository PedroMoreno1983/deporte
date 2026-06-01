"""High-intensity event detection: sprints, accelerations, decelerations, COD.

Consumes the same per-frame pitch coordinates (metres) that feed
``speed_distance.SpeedDistance`` and turns each track's trajectory into the
physical-performance events a coach actually reviews:

  * sprint            — sustained running above a speed threshold
  * acceleration      — a burst of high positive acceleration
  * deceleration      — hard braking (high negative acceleration)
  * direction_change  — a sharp change of heading while moving (COD)

Speed is EMA-smoothed over a short window (matching ``SpeedDistance``) and an
implausible per-frame jump (a tracking id swap) is treated as a discontinuity
rather than a 40 m/s "sprint". Thresholds are configurable with defaults tuned
for youth / lower-division football (Path C). Pure-python — no heavy deps — so
it always runs and is fully unit-testable.

Refs: standard GPS/optical-tracking definitions (high-speed-running & sprint
speed zones, ±accel thresholds, change-of-direction angle).
"""
from __future__ import annotations

import math
from collections import Counter, deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Tuple


KMH_PER_MS = 3.6
_SMOOTH_WINDOW = 5          # frames; mirrors SpeedDistance
_MAX_PLAUSIBLE_MS = 12.0    # ~43 km/h; above this is a tracking discontinuity
_ACCEL_EXIT_FRAC = 0.5      # hysteresis: leave an accel burst at 50% of the entry threshold


def _angle_diff(a: float, b: float) -> float:
    """Smallest signed difference a-b wrapped to [-pi, pi] (radians)."""
    d = (a - b) % (2 * math.pi)
    if d > math.pi:
        d -= 2 * math.pi
    return d


@dataclass
class Event:
    kind:           str        # sprint | acceleration | deceleration | direction_change
    start_t:        float
    end_t:          float
    duration_s:     float
    peak_speed_kmh: float = 0.0
    peak_accel_ms2: float = 0.0
    distance_m:     float = 0.0
    turn_deg:       float = 0.0

    def to_dict(self) -> Dict[str, float | str]:
        d: Dict[str, float | str] = {
            "kind":       self.kind,
            "start_t":    round(self.start_t, 2),
            "end_t":      round(self.end_t, 2),
            "duration_s": self.duration_s,
        }
        if self.peak_speed_kmh:
            d["peak_speed_kmh"] = self.peak_speed_kmh
        if self.peak_accel_ms2:
            d["peak_accel_ms2"] = self.peak_accel_ms2
        if self.distance_m:
            d["distance_m"] = self.distance_m
        if self.turn_deg:
            d["turn_deg"] = self.turn_deg
        return d


@dataclass
class _TrackState:
    speed_window: Deque[float]
    last_xy:      Optional[Tuple[float, float]] = None
    last_t:       Optional[float] = None
    last_speed:   Optional[float] = None
    last_heading: Optional[float] = None
    top_speed:    float = 0.0
    sprint:       Optional[dict] = None
    accel:        Optional[dict] = None
    decel:        Optional[dict] = None
    last_cod_t:   Optional[float] = None
    events:       List[Event] = field(default_factory=list)


class EventDetector:
    """Online detector fed per-frame pitch positions; emits per-track events.

    All speed thresholds are given in km/h and accel in m/s² for readability;
    internally everything is SI. Defaults target youth / lower-division play.
    """

    def __init__(
        self,
        *,
        sprint_kmh: float = 20.0,
        sprint_exit_kmh: Optional[float] = None,   # hysteresis; default 85 % of sprint_kmh
        min_sprint_s: float = 0.5,
        accel_ms2: float = 2.5,
        min_accel_s: float = 0.3,
        cod_angle_deg: float = 60.0,
        cod_min_kmh: float = 10.0,
        cod_refractory_s: float = 0.5,
        smooth_window: int = _SMOOTH_WINDOW,
    ) -> None:
        self.sprint_ms = sprint_kmh / KMH_PER_MS
        self.sprint_exit_ms = (
            sprint_exit_kmh / KMH_PER_MS if sprint_exit_kmh is not None else 0.85 * self.sprint_ms
        )
        self.min_sprint_s = float(min_sprint_s)
        self.accel_ms2 = float(accel_ms2)
        self.min_accel_s = float(min_accel_s)
        self.cod_angle = math.radians(cod_angle_deg)
        self.cod_min_ms = cod_min_kmh / KMH_PER_MS
        self.cod_refractory_s = float(cod_refractory_s)
        self.smooth_window = max(1, int(smooth_window))
        self.tracks: Dict[int, _TrackState] = {}

    # ── ingest ────────────────────────────────────────────────────────────────
    def update(self, track_id: int, x_m: float, y_m: float, t_seconds: float) -> None:
        st = self.tracks.get(track_id)
        if st is None:
            st = _TrackState(speed_window=deque(maxlen=self.smooth_window))
            self.tracks[track_id] = st

        if st.last_xy is None or st.last_t is None:
            st.last_xy, st.last_t = (x_m, y_m), t_seconds
            return

        prev_t = st.last_t
        dt = t_seconds - prev_t
        if dt <= 1e-6:
            return   # non-advancing time (duplicate/back-in-time sample)

        dx, dy = x_m - st.last_xy[0], y_m - st.last_xy[1]
        dist = math.hypot(dx, dy)
        raw_speed = dist / dt

        # A teleport-sized jump is almost always a tracker id swap, not motion.
        # Close any open events at the last good time and reset the baseline.
        if raw_speed > _MAX_PLAUSIBLE_MS:
            self._close_open(st, prev_t)
            st.speed_window.clear()
            st.last_xy, st.last_t = (x_m, y_m), t_seconds
            st.last_speed, st.last_heading = None, None
            return

        heading = math.atan2(dy, dx) if raw_speed > 1e-6 else st.last_heading
        st.speed_window.append(raw_speed)
        speed = sum(st.speed_window) / len(st.speed_window)
        accel = (speed - st.last_speed) / dt if st.last_speed is not None else 0.0
        st.top_speed = max(st.top_speed, speed)

        self._sprint_step(st, prev_t, t_seconds, speed, dist)
        self._accel_step(st, prev_t, t_seconds, speed, accel)
        self._cod_step(st, t_seconds, speed, heading)

        st.last_xy, st.last_t = (x_m, y_m), t_seconds
        st.last_speed, st.last_heading = speed, heading

    # ── state machines ──────────────────────────────────────────────────────────
    def _sprint_step(self, st: _TrackState, prev_t: float, now_t: float, speed: float, dist: float) -> None:
        if st.sprint is None:
            if speed >= self.sprint_ms:
                st.sprint = {"start_t": prev_t, "peak": speed, "dist": dist}
        else:
            st.sprint["peak"] = max(st.sprint["peak"], speed)
            st.sprint["dist"] += dist
            if speed < self.sprint_exit_ms:
                self._record_sprint(st, now_t)

    def _record_sprint(self, st: _TrackState, end_t: float) -> None:
        s = st.sprint
        st.sprint = None
        if s is None:
            return
        dur = end_t - s["start_t"]
        if dur >= self.min_sprint_s:
            st.events.append(Event(
                "sprint", s["start_t"], end_t, round(dur, 2),
                peak_speed_kmh=round(s["peak"] * KMH_PER_MS, 1),
                distance_m=round(s["dist"], 1),
            ))

    def _accel_step(self, st: _TrackState, prev_t: float, now_t: float, speed: float, accel: float) -> None:
        # positive burst
        if st.accel is None:
            if accel >= self.accel_ms2:
                st.accel = {"start_t": prev_t, "peak": accel, "peak_speed": speed}
        else:
            st.accel["peak"] = max(st.accel["peak"], accel)
            st.accel["peak_speed"] = max(st.accel["peak_speed"], speed)
            if accel < self.accel_ms2 * _ACCEL_EXIT_FRAC:
                self._record_accel(st, now_t, "acceleration")
        # negative burst (braking)
        if st.decel is None:
            if accel <= -self.accel_ms2:
                st.decel = {"start_t": prev_t, "peak": accel, "peak_speed": speed}
        else:
            st.decel["peak"] = min(st.decel["peak"], accel)
            st.decel["peak_speed"] = max(st.decel["peak_speed"], speed)
            if accel > -self.accel_ms2 * _ACCEL_EXIT_FRAC:
                self._record_accel(st, now_t, "deceleration")

    def _record_accel(self, st: _TrackState, end_t: float, kind: str) -> None:
        acc = st.accel if kind == "acceleration" else st.decel
        if kind == "acceleration":
            st.accel = None
        else:
            st.decel = None
        if acc is None:
            return
        dur = end_t - acc["start_t"]
        if dur >= self.min_accel_s:
            st.events.append(Event(
                kind, acc["start_t"], end_t, round(dur, 2),
                peak_speed_kmh=round(acc["peak_speed"] * KMH_PER_MS, 1),
                peak_accel_ms2=round(acc["peak"], 2),
            ))

    def _cod_step(self, st: _TrackState, now_t: float, speed: float, heading: Optional[float]) -> None:
        if heading is None or st.last_heading is None or speed < self.cod_min_ms:
            return
        turn = abs(_angle_diff(heading, st.last_heading))
        if turn >= self.cod_angle:
            if st.last_cod_t is None or (now_t - st.last_cod_t) >= self.cod_refractory_s:
                st.events.append(Event(
                    "direction_change", now_t, now_t, 0.0,
                    peak_speed_kmh=round(speed * KMH_PER_MS, 1),
                    turn_deg=round(math.degrees(turn), 1),
                ))
                st.last_cod_t = now_t

    def _close_open(self, st: _TrackState, end_t: float) -> None:
        if st.sprint is not None:
            self._record_sprint(st, end_t)
        if st.accel is not None:
            self._record_accel(st, end_t, "acceleration")
        if st.decel is not None:
            self._record_accel(st, end_t, "deceleration")

    # ── output ────────────────────────────────────────────────────────────────
    def finalize(self) -> None:
        """Close any still-open bursts at each track's last seen time. Idempotent."""
        for st in self.tracks.values():
            if st.last_t is not None:
                self._close_open(st, st.last_t)

    def summary(self) -> List[Dict[str, object]]:
        """Per-track event counts, peak speed and the full event timeline."""
        self.finalize()
        out: List[Dict[str, object]] = []
        for tid, st in self.tracks.items():
            kinds = Counter(e.kind for e in st.events)
            out.append({
                "track_id":          tid,
                "sprints":           kinds.get("sprint", 0),
                "accelerations":     kinds.get("acceleration", 0),
                "decelerations":     kinds.get("deceleration", 0),
                "direction_changes": kinds.get("direction_change", 0),
                "top_speed_kmh":     round(st.top_speed * KMH_PER_MS, 1),
                "sprint_distance_m": round(sum(e.distance_m for e in st.events if e.kind == "sprint"), 1),
                "events":            [e.to_dict() for e in st.events],
            })
        return out
