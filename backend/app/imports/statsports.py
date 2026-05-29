"""
STATSports (Apex / Sonra) GPS session export → TrainingSession.

Apex exports report Dynamic Stress Load (DSL) rather than Catapult's Player
Load; we map DSL into `player_load` (both are accumulated-load proxies) and
also keep the raw DSL in `extra_metrics` so nothing is lost.
"""
from __future__ import annotations

from pathlib import Path

from ..models.training import SessionType
from .base import ImportResult
from .gps import GpsSessionImporter
from .tabular import (
    header_for, parse_date, pick, read_rows, speed_to_kmh, to_float, to_int,
)


class StatSportsSessionImporter(GpsSessionImporter):
    label = "STATSports — Sesión GPS"
    provider_value = "statsports"
    accepted_extensions = (".csv", ".xlsx")

    def parse(self, path: Path) -> ImportResult:
        headers, rows = read_rows(path)
        result = ImportResult(rows_total=len(rows))
        speed_hdr = header_for(headers, "Max Speed", "Maximum Speed", "Top Speed", "Max Velocity")

        for row in rows:
            name = pick(row, "Player Name", "Athlete", "Player", "Name")
            dsl = to_float(pick(row, "Dynamic Stress Load", "DSL", "Stress Load"))

            rec = {
                "player_name": str(name) if name is not None else None,
                "jersey": to_int(pick(row, "Number", "Jersey", "Bib")),
                "session_date": parse_date(pick(row, "Date", "Session Date", "Start Time")),
                "session_type": SessionType.TRAINING,
                "duration_minutes": _minutes(pick(row, "Session Time", "Duration", "Total Time")),
                "total_distance_m": to_float(pick(row, "Total Distance (m)", "Distance (m)", "Total Distance")),
                "high_intensity_distance_m": to_float(pick(
                    row, "High Speed Distance (m)", "HSR (m)", "High Speed Running", "HSR Distance",
                )),
                "sprint_distance_m": to_float(pick(row, "Sprint Distance (m)", "Sprint Distance")),
                "max_speed_kmh": speed_to_kmh(
                    pick(row, "Max Speed", "Maximum Speed", "Top Speed", "Max Velocity"), speed_hdr,
                ),
                "sprints_count": to_int(pick(row, "Number of Sprints", "Sprints", "Sprint Count")),
                "accelerations_count": to_int(pick(row, "Accelerations", "Number of Accelerations", "Acc")),
                "decelerations_count": to_int(pick(row, "Decelerations", "Number of Decelerations", "Dec")),
                "player_load": dsl,
            }
            if dsl is not None:
                rec["extra_metrics"] = {"dynamic_stress_load": dsl}

            result.records.append(rec)

        return result


def _minutes(v):
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
