"""Feature extraction for the injury-risk model.

This module is the single source of truth for the model's feature space. The
**same** :class:`FeatureExtractor` is used at training time (over historical
"as-of" snapshots) and at inference time (as-of today). Sharing one code path
is deliberate: it eliminates train/serve skew, the most common and most
silent cause of a model that looks great offline and fails in production.

Every feature maps to a real column that the platform already ingests
(training sessions, injuries, wellness questionnaires, objective recovery
records from Polar/Garmin, and match minutes). Nothing here is synthetic.

Leakage contract
----------------
For a snapshot taken at ``as_of`` the extractor reads **only** data with a date
``<= as_of``. The label (injury inside the prediction horizon) is computed
elsewhere (``dataset.py``) strictly **after** ``as_of``. Keeping the cut here
guarantees that a historical training row never peeks at the future.

Missing-value policy
--------------------
Continuous windowed features (load, wellness, recovery) are ``NaN`` when there
is no data in the window — XGBoost learns a default split direction for missing
values natively, so we do *not* impute. Count/recency features
(``injuries_*``, ``days_since_injury``) use real zeros / a far-past sentinel
because "never injured" is genuine information, not a missing value.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean, pstdev
from typing import Dict, List, Optional, Sequence

from sqlalchemy.orm import Session

from ...models.injury import Injury, InjuryMechanism, InjurySeverity
from ...models.match import Match, MatchStat
from ...models.player import Player
from ...models.recovery import RecoveryRecord
from ...models.training import TrainingSession
from ...models.wellness import WellnessEntry

NAN = float("nan")

# Far-past sentinel (≈10 years) for "no injury on record". Monotonic and
# meaningful: more days-since-injury = lower residual risk.
_NO_INJURY_DAYS = 3650.0


# Ordered feature contract. The order is persisted with every trained model and
# validated on load, so adding/removing/reordering a feature here without
# retraining is caught instead of silently corrupting predictions.
FEATURE_NAMES: List[str] = [
    "age_years",
    "acwr",
    "weekly_load_7d",
    "chronic_load_28d",
    "load_monotony",
    "load_strain",
    "total_distance_7d",
    "hi_distance_7d",
    "sprint_distance_7d",
    "sprints_7d",
    "accel_7d",
    "decel_7d",
    "sessions_7d",
    "match_minutes_14d",
    "injuries_365d",
    "injuries_career",
    "days_since_injury",
    "reinjury_count",
    "severe_injuries_career",
    "wellness_fatigue_7d",
    "wellness_soreness_7d",
    "wellness_sleep_7d",
    "wellness_stress_7d",
    "wellness_score_7d",
    "hrv_rmssd_7d",
    "resting_hr_7d",
    "sleep_hours_7d",
]

# Human-readable Spanish labels, surfaced in the SHAP-driven `factors` payload
# that the frontend renders. Keyed by feature name.
FEATURE_LABELS: Dict[str, str] = {
    "age_years": "Edad",
    "acwr": "Carga aguda/crónica (ACWR)",
    "weekly_load_7d": "Carga semanal (UA, 7d)",
    "chronic_load_28d": "Carga crónica (UA/sem, 28d)",
    "load_monotony": "Monotonía de carga (7d)",
    "load_strain": "Strain de carga (7d)",
    "total_distance_7d": "Distancia total (m, 7d)",
    "hi_distance_7d": "Distancia alta intensidad (m, 7d)",
    "sprint_distance_7d": "Distancia en sprint (m, 7d)",
    "sprints_7d": "Nº de sprints (7d)",
    "accel_7d": "Aceleraciones (7d)",
    "decel_7d": "Desaceleraciones (7d)",
    "sessions_7d": "Sesiones de entrenamiento (7d)",
    "match_minutes_14d": "Minutos de partido (14d)",
    "injuries_365d": "Lesiones últimos 12 meses",
    "injuries_career": "Lesiones en su historial",
    "days_since_injury": "Días desde última lesión",
    "reinjury_count": "Recidivas registradas",
    "severe_injuries_career": "Lesiones graves (grado 3-4)",
    "wellness_fatigue_7d": "Fatiga reportada (7d)",
    "wellness_soreness_7d": "Dolor muscular reportado (7d)",
    "wellness_sleep_7d": "Calidad de sueño reportada (7d)",
    "wellness_stress_7d": "Estrés reportado (7d)",
    "wellness_score_7d": "Bienestar global (7d)",
    "hrv_rmssd_7d": "HRV / RMSSD (ms, 7d)",
    "resting_hr_7d": "FC en reposo (lpm, 7d)",
    "sleep_hours_7d": "Horas de sueño (7d)",
}

assert set(FEATURE_LABELS) == set(FEATURE_NAMES), "FEATURE_LABELS must cover FEATURE_NAMES"


def _avg(values: Sequence[Optional[float]]) -> float:
    clean = [float(v) for v in values if v is not None]
    return mean(clean) if clean else NAN


class FeatureExtractor:
    """Computes the ordered feature vector for a player as-of a given date.

    Stateless; methods take the DB session so the extractor can run against the
    request-scoped session at inference time and against any session while
    building a historical training set.
    """

    feature_names: List[str] = FEATURE_NAMES

    # -- public API ----------------------------------------------------------
    def extract(self, db: Session, player: Player, as_of: date) -> Dict[str, float]:
        """Return a ``{feature_name: value}`` dict using only data ``<= as_of``."""
        d7_lo = as_of - timedelta(days=6)     # 7-day window, inclusive of as_of
        d28_lo = as_of - timedelta(days=27)   # 28-day window
        d14_lo = as_of - timedelta(days=13)   # 14-day window
        d365_lo = as_of - timedelta(days=364)

        feats: Dict[str, float] = {}

        # --- Age ---
        if player.date_of_birth:
            feats["age_years"] = round((as_of - player.date_of_birth).days / 365.25, 2)
        else:
            feats["age_years"] = NAN

        # --- Training load (7d / 28d), monotony, strain ---
        sessions_28 = (
            db.query(TrainingSession)
            .filter(
                TrainingSession.player_id == player.id,
                TrainingSession.session_date >= d28_lo,
                TrainingSession.session_date <= as_of,
            )
            .all()
        )
        daily_load: Dict[date, float] = defaultdict(float)
        for s in sessions_28:
            if s.session_load is not None:
                daily_load[s.session_date] += float(s.session_load)

        week_days = [d7_lo + timedelta(days=i) for i in range(7)]
        daily_7 = [daily_load.get(day, 0.0) for day in week_days]
        weekly_load = sum(daily_7)
        chronic_weekly = sum(daily_load.values()) / 4.0  # 28d → weekly-equivalent

        feats["weekly_load_7d"] = round(weekly_load, 1) if weekly_load else NAN
        feats["chronic_load_28d"] = round(chronic_weekly, 1) if chronic_weekly else NAN

        # Monotony = mean / SD of daily load across the 7 calendar days
        # (rest days count as 0). Strain = weekly load × monotony.
        sd = pstdev(daily_7) if len(daily_7) > 1 else 0.0
        if weekly_load > 0 and sd > 0:
            monotony = mean(daily_7) / sd
            feats["load_monotony"] = round(monotony, 3)
            feats["load_strain"] = round(weekly_load * monotony, 1)
        else:
            feats["load_monotony"] = NAN
            feats["load_strain"] = NAN

        # --- ACWR: prefer the vendor/derived value already stored on the most
        #     recent session; fall back to a computed 7d:28d ratio. ---
        last_acwr_row = (
            db.query(TrainingSession)
            .filter(
                TrainingSession.player_id == player.id,
                TrainingSession.session_date <= as_of,
                TrainingSession.acwr.isnot(None),
            )
            .order_by(TrainingSession.session_date.desc())
            .first()
        )
        if last_acwr_row is not None:
            feats["acwr"] = round(float(last_acwr_row.acwr), 3)
        elif chronic_weekly > 0:
            feats["acwr"] = round(weekly_load / chronic_weekly, 3)
        else:
            feats["acwr"] = NAN

        # --- GPS volumes (7d) ---
        sessions_7 = [s for s in sessions_28 if s.session_date >= d7_lo]
        feats["total_distance_7d"] = _sum_attr(sessions_7, "total_distance_m")
        feats["hi_distance_7d"] = _sum_attr(sessions_7, "high_intensity_distance_m")
        feats["sprint_distance_7d"] = _sum_attr(sessions_7, "sprint_distance_m")
        feats["sprints_7d"] = _sum_attr(sessions_7, "sprints_count")
        feats["accel_7d"] = _sum_attr(sessions_7, "accelerations_count")
        feats["decel_7d"] = _sum_attr(sessions_7, "decelerations_count")
        feats["sessions_7d"] = float(len(sessions_7))

        # --- Match minutes (14d) ---
        minutes_rows = (
            db.query(MatchStat.minutes_played)
            .join(Match, MatchStat.match_id == Match.id)
            .filter(
                MatchStat.player_id == player.id,
                Match.date >= d14_lo,
                Match.date <= as_of,
            )
            .all()
        )
        feats["match_minutes_14d"] = float(sum((m[0] or 0) for m in minutes_rows))

        # --- Injury history (the single strongest predictor of re-injury) ---
        injuries = (
            db.query(Injury)
            .filter(Injury.player_id == player.id, Injury.injury_date <= as_of)
            .all()
        )
        feats["injuries_career"] = float(len(injuries))
        feats["injuries_365d"] = float(
            sum(1 for i in injuries if i.injury_date >= d365_lo)
        )
        feats["reinjury_count"] = float(
            sum(1 for i in injuries if i.mechanism == InjuryMechanism.REINJURY)
        )
        feats["severe_injuries_career"] = float(
            sum(
                1 for i in injuries
                if i.severity in (InjurySeverity.GRADE_3, InjurySeverity.GRADE_4)
            )
        )
        if injuries:
            last = max(i.injury_date for i in injuries)
            feats["days_since_injury"] = float((as_of - last).days)
        else:
            feats["days_since_injury"] = _NO_INJURY_DAYS

        # --- Subjective wellness questionnaire (7d means) ---
        wellness = (
            db.query(WellnessEntry)
            .filter(
                WellnessEntry.player_id == player.id,
                WellnessEntry.entry_date >= d7_lo,
                WellnessEntry.entry_date <= as_of,
            )
            .all()
        )
        feats["wellness_fatigue_7d"] = _avg([w.fatigue for w in wellness])
        feats["wellness_soreness_7d"] = _avg([w.muscle_soreness for w in wellness])
        feats["wellness_sleep_7d"] = _avg([w.sleep_quality for w in wellness])
        feats["wellness_stress_7d"] = _avg([w.stress for w in wellness])
        feats["wellness_score_7d"] = _avg([w.wellness_score for w in wellness])

        # --- Objective recovery physiology (7d means; Polar/Garmin) ---
        recovery = (
            db.query(RecoveryRecord)
            .filter(
                RecoveryRecord.player_id == player.id,
                RecoveryRecord.record_date >= d7_lo,
                RecoveryRecord.record_date <= as_of,
            )
            .all()
        )
        feats["hrv_rmssd_7d"] = _avg([r.hrv_rmssd for r in recovery])
        feats["resting_hr_7d"] = _avg([r.resting_hr for r in recovery])
        feats["sleep_hours_7d"] = _avg([r.sleep_duration_h for r in recovery])

        return feats

    def extract_vector(self, db: Session, player: Player, as_of: date) -> List[float]:
        """Ordered feature vector (``FEATURE_NAMES`` order), ready for the model."""
        feats = self.extract(db, player, as_of)
        return [float(feats[name]) for name in self.feature_names]

    @staticmethod
    def has_signal(feats: Dict[str, float]) -> bool:
        """True if the snapshot carries enough real data to be worth scoring.

        Filters out empty snapshots (e.g. a player with no recent activity) so
        the training set isn't padded with all-missing rows.
        """
        if feats.get("sessions_7d", 0) and feats["sessions_7d"] > 0:
            return True
        for key in ("wellness_score_7d", "hrv_rmssd_7d", "weekly_load_7d"):
            v = feats.get(key, NAN)
            if v is not None and not math.isnan(v):
                return True
        # Injury history alone is signal even without recent activity.
        return bool(feats.get("injuries_career", 0))


def _sum_attr(sessions: Sequence[TrainingSession], attr: str) -> float:
    vals = [getattr(s, attr) for s in sessions]
    clean = [float(v) for v in vals if v is not None]
    return float(sum(clean)) if clean else NAN
