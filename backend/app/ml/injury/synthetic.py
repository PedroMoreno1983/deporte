"""Synthetic training data for the injury-risk model.

WHY THIS EXISTS
---------------
A supervised injury model needs labelled history (player-snapshots tagged with
"got injured in the next N days"). A brand-new club deployment has none on day
one. This generator produces a *realistic but synthetic* dataset so that:

  * the prediction endpoint ships with a working trained model on day one
    (cold-start), instead of falling back to heuristics forever, and
  * CI can train→explain→predict end-to-end deterministically, without a real
    medical dataset in the repo.

HONESTY / CLINICAL VALIDITY
---------------------------
The relationships encoded below (high ACWR, high strain, prior injuries, poor
wellness, suppressed HRV → higher risk) reflect the sports-science literature,
but the *coefficients are invented*. A model trained only on this data is a
sensible prior, NOT a clinically validated predictor. Real predictive validity
requires retraining on the club's own injury history via ``dataset.py``. This
limitation is surfaced in the model metadata (``trained_on="synthetic"``).
"""
from __future__ import annotations

from typing import Optional, Tuple

import numpy as np

from .features import FEATURE_NAMES

# Column index lookup so the signal weights below read by name, not position.
_IDX = {name: i for i, name in enumerate(FEATURE_NAMES)}


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-z))


def generate(
    n: int = 4000,
    *,
    seed: int = 42,
    positive_rate: float = 0.18,
    missing_rate: float = 0.12,
) -> Tuple[np.ndarray, np.ndarray]:
    """Return ``(X, y)`` with ``X`` shaped ``(n, len(FEATURE_NAMES))``.

    ``y`` is a 0/1 injury label. ``positive_rate`` is the approximate base rate
    of positives (injury epidemiology in football sits roughly here per 1000h
    exposure once windowed). ``missing_rate`` randomly blanks recovery/wellness
    cells to mirror real-world sparse sensor coverage so the model learns to
    cope with NaN exactly as it must in production.
    """
    rng = np.random.default_rng(seed)
    F = len(FEATURE_NAMES)
    X = np.full((n, F), np.nan, dtype=float)

    def col(name: str) -> int:
        return _IDX[name]

    # --- Draw plausible marginal distributions -------------------------------
    age = np.clip(rng.normal(26, 4, n), 16, 40)
    X[:, col("age_years")] = age

    weekly = np.clip(rng.normal(1800, 650, n), 150, 5200)
    X[:, col("weekly_load_7d")] = weekly
    chronic = np.clip(weekly / np.clip(rng.normal(1.05, 0.18, n), 0.5, 2.2), 150, 5200)
    X[:, col("chronic_load_28d")] = chronic
    acwr = np.clip(weekly / chronic, 0.4, 2.4)
    X[:, col("acwr")] = acwr
    monotony = np.clip(rng.normal(1.6, 0.5, n), 0.4, 3.6)
    X[:, col("load_monotony")] = monotony
    X[:, col("load_strain")] = weekly * monotony

    X[:, col("total_distance_7d")] = np.clip(weekly * rng.normal(11, 2, n), 1000, 90000)
    X[:, col("hi_distance_7d")] = np.clip(weekly * rng.normal(0.9, 0.25, n), 50, 12000)
    X[:, col("sprint_distance_7d")] = np.clip(weekly * rng.normal(0.18, 0.06, n), 0, 4000)
    X[:, col("sprints_7d")] = np.clip(rng.normal(28, 12, n), 0, 120).round()
    X[:, col("accel_7d")] = np.clip(rng.normal(70, 25, n), 0, 250).round()
    X[:, col("decel_7d")] = np.clip(rng.normal(68, 25, n), 0, 250).round()
    X[:, col("sessions_7d")] = np.clip(rng.normal(5, 1.4, n), 1, 9).round()
    X[:, col("match_minutes_14d")] = np.clip(rng.normal(140, 70, n), 0, 360).round()

    inj_365 = rng.poisson(0.45, n).astype(float)
    X[:, col("injuries_365d")] = inj_365
    career_extra = rng.poisson(0.8, n).astype(float)
    X[:, col("injuries_career")] = inj_365 + career_extra
    X[:, col("severe_injuries_career")] = np.minimum(
        X[:, col("injuries_career")], rng.poisson(0.3, n)
    )
    X[:, col("reinjury_count")] = np.minimum(inj_365, rng.binomial(1, 0.35, n))
    # Days since last injury: far past if none in the last year, else recent.
    days = np.where(inj_365 > 0, rng.uniform(5, 220, n), 3650.0)
    X[:, col("days_since_injury")] = days

    # Wellness: 1 (bad) – 10 (good); higher is better.
    X[:, col("wellness_fatigue_7d")] = np.clip(rng.normal(6.6, 1.5, n), 1, 10)
    X[:, col("wellness_soreness_7d")] = np.clip(rng.normal(6.5, 1.6, n), 1, 10)
    X[:, col("wellness_sleep_7d")] = np.clip(rng.normal(6.8, 1.4, n), 1, 10)
    X[:, col("wellness_stress_7d")] = np.clip(rng.normal(6.7, 1.5, n), 1, 10)
    X[:, col("wellness_score_7d")] = np.clip(
        (X[:, col("wellness_fatigue_7d")] + X[:, col("wellness_soreness_7d")]
         + X[:, col("wellness_sleep_7d")] + X[:, col("wellness_stress_7d")]) / 4.0
        + rng.normal(0, 0.3, n),
        1, 10,
    )

    X[:, col("hrv_rmssd_7d")] = np.clip(rng.normal(70, 18, n), 20, 140)
    X[:, col("resting_hr_7d")] = np.clip(rng.normal(56, 7, n), 38, 90)
    X[:, col("sleep_hours_7d")] = np.clip(rng.normal(7.4, 1.1, n), 3.5, 11)

    # --- Latent risk: standardise drivers, combine, add noise ----------------
    def z(name: str) -> np.ndarray:
        v = X[:, col(name)]
        return (v - np.nanmean(v)) / (np.nanstd(v) + 1e-9)

    # ACWR risk is U-shaped (both under- and over-load are risky); model the
    # over-load arm plus a sharp penalty above 1.5 — the classic danger zone.
    acwr_over = np.maximum(acwr - 1.1, 0.0)
    acwr_danger = (acwr > 1.5).astype(float)

    logit = (
        0.9 * z("load_strain")
        + 0.7 * acwr_over * 2.0
        + 1.1 * acwr_danger
        + 0.8 * z("injuries_365d")
        + 0.5 * z("reinjury_count")
        + 0.4 * z("severe_injuries_career")
        - 0.6 * z("days_since_injury")          # more days since = safer
        - 0.5 * z("wellness_score_7d")          # better wellness = safer
        - 0.45 * z("hrv_rmssd_7d")              # higher HRV = safer
        + 0.35 * z("resting_hr_7d")             # higher resting HR = worse
        + 0.3 * z("match_minutes_14d")
        + 0.25 * np.maximum(z("age_years"), 0)  # older skews riskier
        + rng.normal(0, 0.7, n)                 # irreducible noise / contact injuries
    )
    # Shift intercept to hit the requested base rate.
    target_logit = np.log(positive_rate / (1 - positive_rate))
    logit = logit - np.mean(logit) + target_logit
    y = rng.binomial(1, _sigmoid(logit)).astype(int)

    # --- Inject realistic missingness into sensor-derived columns ------------
    sparse_cols = [
        "hrv_rmssd_7d", "resting_hr_7d", "sleep_hours_7d",
        "wellness_fatigue_7d", "wellness_soreness_7d", "wellness_sleep_7d",
        "wellness_stress_7d", "wellness_score_7d",
    ]
    for name in sparse_cols:
        mask = rng.random(n) < missing_rate
        X[mask, col(name)] = np.nan

    return X, y
