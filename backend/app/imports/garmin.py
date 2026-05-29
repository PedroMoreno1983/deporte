"""
Garmin .fit (binary) export → TrainingSession (+ RecoveryRecord when HRV present).

A `.fit` file is one device's one activity, so it carries no player name. The
player is supplied at upload time (`options["player_id"]`); without it every row
is reported skipped rather than guessed.

We derive distance bands and sprint counts from the per-sample `record` stream
(Garmin only reports totals, not the >19.8/>25.2 km/h splits clubs care about),
and RMSSD from `hrv` R-R intervals when the activity is an HRV/orthostatic test.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import List, Optional, Tuple

from ..models.training import SessionType
from .base import BaseImporter, ImportResult
from .persist import write_gps_sessions, write_recovery_records

# Speed band thresholds (km/h) — the same conventions used elsewhere in the app.
HIR_KMH = 19.8     # high-intensity running
SPRINT_KMH = 25.2  # sprint
# Hysteresis so a single noisy sample doesn't inflate the sprint count.
SPRINT_EXIT_KMH = SPRINT_KMH - 2.0
MAX_SAMPLE_GAP_S = 5.0  # ignore integration across pauses/auto-stops


class GarminFitImporter(BaseImporter):
    label = "Garmin — Actividad .fit (GPS + HRV)"
    provider_value = "garmin_fit"
    accepted_extensions = (".fit",)

    def parse(self, path: Path) -> ImportResult:
        try:
            from fitparse import FitFile
        except ImportError as e:  # pragma: no cover
            raise RuntimeError("Falta fitparse para leer .fit (pip install fitparse)") from e

        fit = FitFile(str(path))
        result = ImportResult()

        sessions = list(_messages(fit, "session"))
        records = list(_messages(fit, "record"))
        hrv_msgs = list(_messages(fit, "hrv"))

        samples = _record_samples(records)
        bands = _distance_bands(samples)

        sess = sessions[0] if sessions else None
        start = _get(sess, "start_time") if sess else None
        session_date: Optional[date] = start.date() if start is not None else (
            samples[0][2] if samples and samples[0][2] is not None else None
        )

        duration_min = None
        timer_s = _getf(sess, "total_timer_time", "total_elapsed_time") if sess else None
        if timer_s is not None:
            duration_min = int(round(timer_s / 60))

        total_distance = _getf(sess, "total_distance") if sess else None
        if total_distance is None and samples:
            total_distance = round(bands["total_m"], 1)

        max_speed_mps = _getf(sess, "enhanced_max_speed", "max_speed") if sess else None
        if max_speed_mps is None and bands["max_speed_mps"]:
            max_speed_mps = bands["max_speed_mps"]
        max_speed_kmh = round(max_speed_mps * 3.6, 2) if max_speed_mps is not None else None

        gps = {
            "_type": "gps",
            "player_name": None,
            "jersey": None,
            "session_date": session_date,
            "session_type": SessionType.TRAINING,
            "duration_minutes": duration_min,
            "total_distance_m": total_distance,
            "high_intensity_distance_m": round(bands["hir_m"], 1) if samples else None,
            "sprint_distance_m": round(bands["sprint_m"], 1) if samples else None,
            "max_speed_kmh": max_speed_kmh,
            "sprints_count": bands["sprint_count"] if samples else None,
        }
        calories = _getf(sess, "total_calories") if sess else None
        if calories is not None:
            gps["extra_metrics"] = {"energy_kcal": calories}
        result.records.append(gps)

        rmssd = _rmssd_ms(hrv_msgs)
        resting_hr = _resting_hr(sess, samples)
        if rmssd is not None or resting_hr is not None:
            result.records.append({
                "_type": "recovery",
                "player_name": None,
                "jersey": None,
                "record_date": session_date,
                "hrv_rmssd": rmssd,
                "resting_hr": resting_hr,
            })

        result.rows_total = len(result.records)
        return result

    def apply(self, result: ImportResult, db, *, club_id: int) -> None:
        player_id = self.options.get("player_id")
        gps = [r for r in result.records if r.get("_type") == "gps"]
        recov = [r for r in result.records if r.get("_type") == "recovery"]
        for r in result.records:
            if player_id is not None:
                r["player_id"] = int(player_id)

        imported = skipped = 0
        if gps:
            gi, gs = write_gps_sessions(gps, db, club_id, result)
            imported += gi
            skipped += gs
        if recov:
            ri, rs = write_recovery_records(recov, db, club_id, result, source="garmin")
            imported += ri
            skipped += rs

        result.rows_imported = imported
        result.rows_skipped = skipped
        result.summary = {
            "gps_sessions": 1 if gps and imported else 0,
            "recovery_records": 1 if recov and imported else 0,
            "players_unmatched": skipped,
        }


# ── FIT field helpers ────────────────────────────────────────────────────

def _messages(fit, name: str):
    try:
        return fit.get_messages(name)
    except Exception:  # noqa: BLE001 — unknown message type in this file
        return []


def _get(msg, *names):
    for n in names:
        try:
            v = msg.get_value(n)
        except Exception:  # noqa: BLE001
            v = None
        if v is not None:
            return v
    return None


def _getf(msg, *names) -> Optional[float]:
    v = _get(msg, *names)
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _record_samples(records) -> List[Tuple[float, Optional[float], Optional[date]]]:
    """(elapsed_seconds, speed_mps, date) sorted by time."""
    out = []
    t0 = None
    for r in records:
        ts = _get(r, "timestamp")
        spd = _getf(r, "enhanced_speed", "speed")
        if ts is None:
            continue
        if t0 is None:
            t0 = ts
        elapsed = (ts - t0).total_seconds()
        out.append((elapsed, spd, ts.date()))
    out.sort(key=lambda x: x[0])
    return out


def _distance_bands(samples) -> dict:
    hir_m = sprint_m = total_m = 0.0
    max_speed = 0.0
    sprint_count = 0
    in_sprint = False
    prev_t = None
    for t, spd, _d in samples:
        if spd is not None:
            max_speed = max(max_speed, spd)
            kmh = spd * 3.6
            if prev_t is not None:
                dt = t - prev_t
                if 0 < dt <= MAX_SAMPLE_GAP_S:
                    dist = spd * dt
                    total_m += dist
                    if kmh >= HIR_KMH:
                        hir_m += dist
                    if kmh >= SPRINT_KMH:
                        sprint_m += dist
            if not in_sprint and kmh >= SPRINT_KMH:
                in_sprint = True
                sprint_count += 1
            elif in_sprint and kmh < SPRINT_EXIT_KMH:
                in_sprint = False
        prev_t = t
    return {
        "hir_m": hir_m,
        "sprint_m": sprint_m,
        "total_m": total_m,
        "sprint_count": sprint_count,
        "max_speed_mps": max_speed or None,
    }


def _rmssd_ms(hrv_msgs) -> Optional[float]:
    """Root-mean-square of successive R-R differences, in ms.

    Garmin `hrv` messages carry a `time` field that is a list of R-R intervals
    in seconds, padded with None / 65.535s sentinels between writes.
    """
    rr_ms: List[float] = []
    for m in hrv_msgs:
        val = _get(m, "time")
        seq = val if isinstance(val, (list, tuple)) else [val]
        for x in seq:
            try:
                f = float(x)
            except (TypeError, ValueError):
                continue
            if 0.0 < f < 3.0:  # plausible R-R interval (20–infinite bpm guard)
                rr_ms.append(f * 1000.0)
    if len(rr_ms) < 2:
        return None
    diffs = [rr_ms[i + 1] - rr_ms[i] for i in range(len(rr_ms) - 1)]
    mssd = sum(d * d for d in diffs) / len(diffs)
    return round(mssd ** 0.5, 1)


def _resting_hr(sess, samples) -> Optional[int]:
    hr = _getf(sess, "avg_heart_rate") if sess is not None else None
    if hr is not None:
        return int(round(hr))
    return None
