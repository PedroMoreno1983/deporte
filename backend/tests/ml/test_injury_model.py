"""Tests for the XGBoost + SHAP injury-risk model.

These prove the model is *real*, not a stub:
  * it learns the planted signal (held-out AUC well above chance),
  * train→save→load→predict→explain round-trips,
  * the serving payload honours the {score, level, factors} contract and is
    JSON-serialisable,
  * it degrades to the heuristic when no model is present,
  * feature extraction respects the as-of leakage boundary,
  * the real-DB dataset builder produces forward-looking labels.

xgboost/shap are required to run this module; it is skipped cleanly if the ML
extras aren't installed (the production code path also degrades gracefully).
"""
from __future__ import annotations

import json
from datetime import date, timedelta

import numpy as np
import pytest

pytest.importorskip("xgboost", reason="ML extras (xgboost) not installed")

from app.ml.injury import (  # noqa: E402
    FEATURE_NAMES,
    FeatureExtractor,
    InjuryRiskModel,
    build_dataset,
)
from app.ml.injury.synthetic import generate  # noqa: E402
from app.ml.injury_risk import calculate_injury_risk  # noqa: E402
from app.models.injury import (  # noqa: E402
    BodyZone,
    Injury,
    InjuryMechanism,
    InjurySeverity,
)
from app.models.recovery import RecoveryRecord  # noqa: E402
from app.models.training import TrainingSession  # noqa: E402
from app.models.wellness import WellnessEntry  # noqa: E402


# ----------------------------------------------------------------------------
# Synthetic data + model learning
# ----------------------------------------------------------------------------
def test_synthetic_dataset_shape_and_balance():
    X, y = generate(n=1500, seed=1)
    assert X.shape == (1500, len(FEATURE_NAMES))
    assert set(np.unique(y)).issubset({0, 1})
    # Base rate roughly as configured (not degenerate all-0 / all-1).
    assert 0.08 < y.mean() < 0.32
    # Missingness was injected into the sparse sensor columns.
    assert np.isnan(X).any()


def test_model_learns_signal():
    """A real model must beat chance on held-out synthetic data."""
    X_tr, y_tr = generate(n=4000, seed=10)
    X_te, y_te = generate(n=1500, seed=99)  # different draw

    model = InjuryRiskModel.train(X_tr, y_tr, trained_on="synthetic")
    proba = model.predict_proba(X_te)

    from sklearn.metrics import roc_auc_score

    auc = roc_auc_score(y_te, proba)
    assert auc > 0.72, f"model failed to learn planted signal (AUC={auc:.3f})"


def test_train_save_load_predict_explain(tmp_path):
    X, y = generate(n=1200, seed=7)
    model = InjuryRiskModel.train(X, y, trained_on="synthetic")

    path = model.save(tmp_path)
    assert path.exists()
    assert (tmp_path / "injury_risk.meta.json").exists()

    reloaded = InjuryRiskModel.load(tmp_path)
    assert reloaded.feature_names == FEATURE_NAMES
    assert reloaded.trained_on == "synthetic"

    row = X[:1]
    p_before = float(model.predict_proba(row)[0])
    p_after = float(reloaded.predict_proba(row)[0])
    assert abs(p_before - p_after) < 1e-6  # persistence is lossless

    values, base = reloaded.shap_values(row)
    assert values.shape == (1, len(FEATURE_NAMES))
    assert isinstance(base, float)


def test_load_detects_feature_mismatch(tmp_path, monkeypatch):
    X, y = generate(n=400, seed=3)
    model = InjuryRiskModel.train(X, y, trained_on="synthetic")
    model.save(tmp_path)

    # Simulate code evolving its feature contract after the model was saved.
    monkeypatch.setattr("app.ml.injury.model.FEATURE_NAMES", FEATURE_NAMES + ["x"])
    from app.ml.injury.model import FeatureMismatch

    with pytest.raises(FeatureMismatch):
        InjuryRiskModel.load(tmp_path)


# ----------------------------------------------------------------------------
# Serving contract + fallback
# ----------------------------------------------------------------------------
def _seed_high_risk_player(db, player, club_id):
    """Recent spike load with high ACWR, a fresh injury, poor wellness, low HRV."""
    today = date.today()
    for i in range(6):
        d = today - timedelta(days=i)
        db.add(TrainingSession(
            player_id=player.id, club_id=club_id, session_date=d,
            session_load=900.0 if i < 2 else 250.0, acwr=1.8,
            total_distance_m=7000, high_intensity_distance_m=900,
            sprint_distance_m=300, sprints_count=12,
            accelerations_count=40, decelerations_count=38,
        ))
    db.add(Injury(
        player_id=player.id, injury_date=today - timedelta(days=20),
        injury_type="Rotura muscular", body_zone=BodyZone.THIGH_RIGHT,
        severity=InjurySeverity.GRADE_2, mechanism=InjuryMechanism.NON_CONTACT,
    ))
    for i in range(5):
        d = today - timedelta(days=i)
        db.add(WellnessEntry(
            player_id=player.id, entry_date=d,
            sleep_quality=3, fatigue=3, mood=4, muscle_soreness=3, stress=4,
            wellness_score=3.3,
        ))
        db.add(RecoveryRecord(
            player_id=player.id, club_id=club_id, record_date=d,
            hrv_rmssd=38.0, resting_hr=70, sleep_duration_h=5.5, source="polar",
        ))
    db.commit()


def test_serving_contract_with_model(db, roster, monkeypatch):
    player = roster[0]
    _seed_high_risk_player(db, player, player.club_id)

    # Train a cold-start model into the test's isolated DEPORTE_MODEL_ROOT.
    model = InjuryRiskModel.bootstrap_synthetic(n=2500, seed=5)
    model.save()
    from app.ml.injury.predictor import reset_cache

    reset_cache()

    result = calculate_injury_risk(player.id, db)

    # Contract: exact shape the endpoint + frontend consume.
    assert set(["score", "level", "factors"]).issubset(result)
    assert 0.0 <= result["score"] <= 100.0
    assert result["level"] in {"low", "medium", "high", "critical"}
    assert result["method"] == "model"
    assert result["factors"], "model path must surface SHAP factors"

    for key, f in result["factors"].items():
        assert key in FEATURE_NAMES
        assert {"label", "value", "contribution", "description"}.issubset(f)
        assert f["direction"] in {"up", "down"}

    # Must be JSON-serialisable (stored in a JSON column, returned by FastAPI).
    json.dumps(result)


def test_falls_back_to_heuristic_without_model(db, roster):
    """No model file in the isolated dir → heuristic answer, same contract."""
    player = roster[0]
    db.add(TrainingSession(
        player_id=player.id, club_id=player.club_id,
        session_date=date.today(), session_load=2500.0, acwr=1.7,
    ))
    db.commit()

    result = calculate_injury_risk(player.id, db)

    assert set(["score", "level", "factors"]).issubset(result)
    assert result.get("method") != "model"          # heuristic path
    assert "acwr" in result["factors"]               # heuristic factor key
    assert result["level"] in {"low", "medium", "high", "critical"}
    json.dumps(result)


def test_model_path_used_when_present(db, roster):
    player = roster[0]
    _seed_high_risk_player(db, player, player.club_id)
    InjuryRiskModel.bootstrap_synthetic(n=1500, seed=8).save()
    from app.ml.injury.predictor import get_model, reset_cache

    reset_cache()
    assert get_model() is not None
    assert calculate_injury_risk(player.id, db)["method"] == "model"


# ----------------------------------------------------------------------------
# Feature extraction: leakage boundary + vector contract
# ----------------------------------------------------------------------------
def test_feature_extractor_no_leakage(db, roster):
    player = roster[0]
    as_of = date(2026, 3, 1)

    # Past session (in window) + FUTURE session/injury that must be ignored.
    db.add(TrainingSession(
        player_id=player.id, club_id=player.club_id,
        session_date=as_of - timedelta(days=2), session_load=400.0, acwr=1.2,
    ))
    db.add(TrainingSession(
        player_id=player.id, club_id=player.club_id,
        session_date=as_of + timedelta(days=2), session_load=999.0, acwr=2.2,
    ))
    db.add(Injury(
        player_id=player.id, injury_date=as_of + timedelta(days=5),
        injury_type="Esguince", body_zone=BodyZone.ANKLE_LEFT,
        severity=InjurySeverity.GRADE_1, mechanism=InjuryMechanism.NON_CONTACT,
    ))
    db.commit()

    feats = FeatureExtractor().extract(db, player, as_of)

    assert feats["sessions_7d"] == 1.0                 # future session excluded
    assert feats["acwr"] == 1.2                        # not the future 2.2
    assert feats["injuries_career"] == 0.0             # future injury excluded
    assert feats["days_since_injury"] == 3650.0        # sentinel: none yet


def test_feature_vector_matches_contract(db, roster):
    vec = FeatureExtractor().extract_vector(db, roster[0], date.today())
    assert len(vec) == len(FEATURE_NAMES)
    assert all(isinstance(v, float) for v in vec)      # NaN allowed, all float


# ----------------------------------------------------------------------------
# Real-DB dataset builder
# ----------------------------------------------------------------------------
def test_build_dataset_labels_forward_window(db, roster):
    player = roster[0]
    base = date.today() - timedelta(days=200)

    # Dense training history so snapshots carry signal.
    for i in range(0, 170, 2):
        d = base + timedelta(days=i)
        db.add(TrainingSession(
            player_id=player.id, club_id=player.club_id,
            session_date=d, session_load=400.0, acwr=1.1,
        ))
    # One non-contact injury midway → some forward windows must be positive.
    injury_day = base + timedelta(days=120)
    db.add(Injury(
        player_id=player.id, injury_date=injury_day,
        injury_type="Sobrecarga", body_zone=BodyZone.THIGH_LEFT,
        severity=InjurySeverity.GRADE_1, mechanism=InjuryMechanism.OVERLOAD,
        actual_days_out=10,
    ))
    db.commit()

    X, y, meta = build_dataset(
        db, club_id=player.club_id, horizon_days=28, stride_days=7
    )

    assert X.shape[1] == len(FEATURE_NAMES)
    assert len(y) == len(meta) == X.shape[0]
    assert X.shape[0] > 0
    assert y.sum() >= 1, "an injury must make at least one forward window positive"

    # No snapshot may fall inside the injury lay-off window.
    layoff = {(injury_day + timedelta(days=k)).isoformat() for k in range(0, 11)}
    assert not any(m["as_of"] in layoff for m in meta)
