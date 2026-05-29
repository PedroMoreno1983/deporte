"""
Shared DB-writing routines for importers.

Kept separate from the parsers so the same normalised record shape can be
written by several vendors (e.g. Garmin emits both GPS sessions and recovery
records). All writers are idempotent on (player, date[, type]) so re-running an
import never duplicates rows.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from ..models.player import Player
from ..models.recovery import RecoveryRecord
from ..models.training import SessionType, TrainingSession
from .base import ImportResult
from .resolve import PlayerResolver


def _resolve_player(
    rec: Dict[str, Any],
    resolver: PlayerResolver,
    db: Session,
    club_id: int,
) -> Optional[Player]:
    """Prefer an explicit player_id (Garmin per-device files), else fuzzy-match.

    An explicit id is still tenant-checked so one club can't write into another.
    """
    pid = rec.get("player_id")
    if pid is not None:
        return (
            db.query(Player)
            .filter(Player.id == pid, Player.club_id == club_id)
            .first()
        )
    return resolver.resolve(jersey=rec.get("jersey"), name=rec.get("player_name"))

GPS_FIELDS = (
    "duration_minutes",
    "total_distance_m",
    "high_intensity_distance_m",
    "sprint_distance_m",
    "max_speed_kmh",
    "sprints_count",
    "accelerations_count",
    "decelerations_count",
    "player_load",
    "rpe",
    "session_load",
)

RECOVERY_FIELDS = (
    "hrv_rmssd",
    "resting_hr",
    "sleep_duration_h",
    "sleep_score",
    "recovery_status",
    "readiness",
)


def write_gps_sessions(
    records: List[Dict[str, Any]],
    db: Session,
    club_id: int,
    result: ImportResult,
    resolver: Optional[PlayerResolver] = None,
) -> Tuple[int, int]:
    resolver = resolver or PlayerResolver(db, club_id)
    imported = skipped = 0

    for i, rec in enumerate(records):
        session_date = rec.get("session_date")
        name = rec.get("player_name")
        if session_date is None:
            skipped += 1
            result.add_error(i, f"Fila GPS sin fecha válida (jugador='{name}')")
            continue
        player = _resolve_player(rec, resolver, db, club_id)
        if player is None:
            skipped += 1
            result.add_error(i, f"Jugador no encontrado: '{name}' (dorsal={rec.get('jersey')})")
            continue

        stype = rec.get("session_type") or SessionType.TRAINING
        session = (
            db.query(TrainingSession)
            .filter(
                TrainingSession.player_id == player.id,
                TrainingSession.session_date == session_date,
                TrainingSession.session_type == stype,
            )
            .first()
        )
        if session is None:
            session = TrainingSession(
                player_id=player.id, club_id=club_id,
                session_date=session_date, session_type=stype,
            )
            db.add(session)

        for field in GPS_FIELDS:
            if rec.get(field) is not None:
                setattr(session, field, rec[field])
        if rec.get("extra_metrics"):
            merged = dict(session.extra_metrics or {})
            merged.update(rec["extra_metrics"])
            session.extra_metrics = merged
        imported += 1

    db.commit()
    return imported, skipped


def write_recovery_records(
    records: List[Dict[str, Any]],
    db: Session,
    club_id: int,
    result: ImportResult,
    source: str,
    resolver: Optional[PlayerResolver] = None,
) -> Tuple[int, int]:
    resolver = resolver or PlayerResolver(db, club_id)
    imported = skipped = 0

    for i, rec in enumerate(records):
        rec_date = rec.get("record_date")
        name = rec.get("player_name")
        if rec_date is None:
            skipped += 1
            result.add_error(i, f"Fila recovery sin fecha válida (jugador='{name}')")
            continue
        player = _resolve_player(rec, resolver, db, club_id)
        if player is None:
            skipped += 1
            result.add_error(i, f"Jugador no encontrado: '{name}' (dorsal={rec.get('jersey')})")
            continue

        row = (
            db.query(RecoveryRecord)
            .filter(
                RecoveryRecord.player_id == player.id,
                RecoveryRecord.record_date == rec_date,
            )
            .first()
        )
        if row is None:
            row = RecoveryRecord(
                player_id=player.id, club_id=club_id,
                record_date=rec_date, source=source,
            )
            db.add(row)

        for field in RECOVERY_FIELDS:
            if rec.get(field) is not None:
                setattr(row, field, rec[field])
        if rec.get("extra"):
            merged = dict(row.extra or {})
            merged.update(rec["extra"])
            row.extra = merged
        imported += 1

    db.commit()
    return imported, skipped
