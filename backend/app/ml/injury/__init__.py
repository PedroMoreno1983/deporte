"""Real injury-risk model: XGBoost + SHAP over an ingested feature set.

Public surface:
    FeatureExtractor, FEATURE_NAMES   — the shared train/serve feature space
    InjuryRiskModel                   — train / save / load / predict / explain
    build_dataset                     — labelled snapshots from real club history
    predict_risk                      — serving bridge to the {score,level,factors} API

The heavy ML libraries (xgboost, shap) are imported lazily inside the model
methods, so importing this package never fails on a host without them — the
predictor just returns ``None`` and callers fall back to the heuristic.
"""
from .dataset import build_dataset
from .features import FEATURE_LABELS, FEATURE_NAMES, FeatureExtractor
from .model import InjuryRiskModel, MODEL_VERSION, default_model_dir
from .predictor import get_model, predict_risk, reset_cache

__all__ = [
    "FeatureExtractor",
    "FEATURE_NAMES",
    "FEATURE_LABELS",
    "InjuryRiskModel",
    "MODEL_VERSION",
    "default_model_dir",
    "build_dataset",
    "predict_risk",
    "get_model",
    "reset_cache",
]
