"""Build a labelled training set from a club's *real* history.

This is the path to genuine predictive validity: once a club has accumulated
training-load, wellness, recovery and injury records, we slide an "as-of" window
across each player's timeline and, at each snapshot, ask "did this player suffer
an injury within the next ``horizon_days``?". Features come from
:class:`FeatureExtractor` (data ≤ as_of); the label looks strictly forward, so
there is no leakage.

Snapshots are dropped when:
  * the player has no meaningful data at that date (``has_signal`` is False), or
  * the player is already inside an injury lay-off window (we predict the onset
    of *new* injuries for *available* players, not the obvious fact that an
    already-injured player is unavailable).
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from ...models.injury import Injury
from ...models.player import Player
from ...models.recovery import RecoveryRecord
from ...models.training import TrainingSession
from ...models.wellness import WellnessEntry
from .features import FEATURE_NAMES, FeatureExtractor


def _player_span(db: Session, player_id: int) -> Optional[Tuple[date, date]]:
    """Earliest and latest activity date across all signals for a player."""
    lows: List[date] = []
    highs: List[date] = []
    for model, col in (
        (TrainingSession, TrainingSession.session_date),
        (WellnessEntry, WellnessEntry.entry_date),
        (RecoveryRecord, RecoveryRecord.record_date),
        (Injury, Injury.injury_date),
    ):
        lo = (
            db.query(col)
            .filter(model.player_id == player_id)
            .order_by(col.asc())
            .first()
        )
        hi = (
            db.query(col)
            .filter(model.player_id == player_id)
            .order_by(col.desc())
            .first()
        )
        if lo and lo[0]:
            lows.append(lo[0])
        if hi and hi[0]:
            highs.append(hi[0])
    if not lows or not highs:
        return None
    return min(lows), max(highs)


def _injury_layoff_windows(injuries: List[Injury]) -> List[Tuple[date, date]]:
    """Closed [start, end] dates during which the player is laid off."""
    windows: List[Tuple[date, date]] = []
    for inj in injuries:
        start = inj.injury_date
        if inj.return_date_actual:
            end = inj.return_date_actual
        elif inj.actual_days_out:
            end = start + timedelta(days=int(inj.actual_days_out))
        elif inj.estimated_days_out:
            end = start + timedelta(days=int(inj.estimated_days_out))
        else:
            end = start + timedelta(days=7)  # minimal assumed lay-off
        windows.append((start, end))
    return windows


def _in_any_window(day: date, windows: List[Tuple[date, date]]) -> bool:
    return any(start <= day <= end for start, end in windows)


def build_dataset(
    db: Session,
    *,
    club_id: Optional[int] = None,
    horizon_days: int = 28,
    stride_days: int = 7,
    warmup_days: int = 28,
    as_of_max: Optional[date] = None,
) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, object]]]:
    """Return ``(X, y, meta)`` from real records.

    Parameters
    ----------
    horizon_days : prediction window; label = injury within this many days.
    stride_days  : spacing between consecutive snapshots per player.
    warmup_days  : skip the first N days of a player's history (features need a
                   trailing window to be meaningful).
    as_of_max    : do not emit snapshots whose horizon extends past this date
                   (defaults to today minus horizon, so every label is observed).
    """
    extractor = FeatureExtractor()
    today = date.today()
    horizon_cap = as_of_max or (today - timedelta(days=horizon_days))

    players_q = db.query(Player)
    if club_id is not None:
        players_q = players_q.filter(Player.club_id == club_id)
    players = players_q.all()

    rows: List[List[float]] = []
    labels: List[int] = []
    meta: List[Dict[str, object]] = []

    for player in players:
        span = _player_span(db, player.id)
        if span is None:
            continue
        start, end = span
        first_as_of = start + timedelta(days=warmup_days)
        last_as_of = min(end, horizon_cap)
        if first_as_of > last_as_of:
            continue

        injuries = (
            db.query(Injury)
            .filter(Injury.player_id == player.id)
            .order_by(Injury.injury_date.asc())
            .all()
        )
        layoffs = _injury_layoff_windows(injuries)
        injury_dates = [i.injury_date for i in injuries]

        as_of = first_as_of
        while as_of <= last_as_of:
            if _in_any_window(as_of, layoffs):
                as_of += timedelta(days=stride_days)
                continue

            feats = extractor.extract(db, player, as_of)
            if not FeatureExtractor.has_signal(feats):
                as_of += timedelta(days=stride_days)
                continue

            horizon_end = as_of + timedelta(days=horizon_days)
            label = int(any(as_of < d <= horizon_end for d in injury_dates))

            rows.append([float(feats[name]) for name in FEATURE_NAMES])
            labels.append(label)
            meta.append({"player_id": player.id, "as_of": as_of.isoformat(), "label": label})

            as_of += timedelta(days=stride_days)

    X = np.asarray(rows, dtype=float) if rows else np.empty((0, len(FEATURE_NAMES)))
    y = np.asarray(labels, dtype=int) if labels else np.empty((0,), dtype=int)
    return X, y, meta
