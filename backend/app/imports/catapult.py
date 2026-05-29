"""
Catapult (OpenField) GPS session export → TrainingSession.

Targets the per-athlete activity/period CSV export. Header names vary across
OpenField versions and parameter sets, so every field has several aliases and
unmatched fields are simply left null rather than failing the row.
"""
from __future__ import annotations

from pathlib import Path

from ..models.training import SessionType
from .base import ImportResult
from .gps import GpsSessionImporter
from .tabular import (
    header_for, parse_date, pick, read_rows, speed_to_kmh, to_float, to_int,
)


class CatapultSessionImporter(GpsSessionImporter):
    label = "Catapult — Sesión GPS"
    provider_value = "catapult"
    accepted_extensions = (".csv", ".xlsx")

    def parse(self, path: Path) -> ImportResult:
        headers, rows = read_rows(path)
        result = ImportResult(rows_total=len(rows))
        speed_hdr = header_for(
            headers, "Maximum Velocity", "Max Velocity", "Max Vel", "Max Speed", "Velocity Max",
        )

        for row in rows:
            name = pick(row, "Athlete", "Player Name", "Player", "Name", "Athlete Name")
            activity = pick(row, "Activity Name", "Activity", "Session", "Period Name") or ""
            stype = SessionType.MATCH if any(
                k in str(activity).lower() for k in ("match", "game", "partido")
            ) else SessionType.TRAINING

            rec = {
                "player_name": str(name) if name is not None else None,
                "jersey": to_int(pick(row, "Jersey", "Number", "Bib")),
                "session_date": parse_date(
                    pick(row, "Date", "Activity Date", "Period Start Time", "Start Time", "Day")
                ),
                "session_type": stype,
                "duration_minutes": _minutes(pick(row, "Duration", "Total Duration", "Field Time", "Total Time")),
                "total_distance_m": to_float(pick(row, "Total Distance (m)", "Total Distance", "Distance (m)", "Distance")),
                "high_intensity_distance_m": to_float(pick(
                    row, "High Speed Distance", "HSR Distance", "High Speed Running Distance",
                    "Velocity Band 5 Distance", "HID",
                )),
                "sprint_distance_m": to_float(pick(
                    row, "Sprint Distance", "Velocity Band 6 Distance", "Sprint Distance (m)",
                )),
                "max_speed_kmh": speed_to_kmh(
                    pick(row, "Maximum Velocity", "Max Velocity", "Max Vel", "Max Speed", "Velocity Max"),
                    speed_hdr,
                ),
                "sprints_count": to_int(pick(row, "Sprints", "Sprint Efforts", "Sprint Count")),
                "accelerations_count": to_int(pick(
                    row, "Accelerations", "Total Accelerations", "Acceleration Efforts", "Acc Efforts",
                )),
                "decelerations_count": to_int(pick(
                    row, "Decelerations", "Total Decelerations", "Deceleration Efforts", "Dec Efforts",
                )),
                "player_load": to_float(pick(row, "Player Load", "PlayerLoad", "Total Player Load")),
            }

            extra = {}
            for label, key in (("Metabolic Power", "metabolic_power"), ("Energy", "energy_kcal")):
                v = to_float(pick(row, label))
                if v is not None:
                    extra[key] = v
            if extra:
                rec["extra_metrics"] = extra

            result.records.append(rec)

        return result


def _minutes(v):
    """Duration may be minutes (float) or HH:MM:SS."""
    if v is None:
        return None
    s = str(v).strip()
    if ":" in s:
        parts = [float(p) for p in s.split(":") if p != ""]
        if len(parts) == 3:
            return int(round(parts[0] * 60 + parts[1] + parts[2] / 60))
        if len(parts) == 2:
            return int(round(parts[0] + parts[1] / 60))
    f = to_float(v)
    return int(round(f)) if f is not None else None
