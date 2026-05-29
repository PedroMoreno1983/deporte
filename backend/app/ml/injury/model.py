"""XGBoost injury-risk model: train, persist, predict, explain.

Design choices
--------------
* **XGBoost** (gradient-boosted trees) over the tabular feature set. Trees
  handle the mixed scales, non-linear ACWR risk, and ``NaN`` missingness
  natively — no scaling/imputation pipeline to drift.
* **SHAP** TreeExplainer for per-prediction attribution. If the ``shap`` package
  is unavailable at runtime we fall back to XGBoost's built-in
  ``pred_contribs=True``, which computes the *same* exact TreeSHAP values from
  the booster itself. Either way the explanations are real Shapley values, not
  gradient/heuristic approximations.
* Lazy imports: ``xgboost``/``shap`` are only imported inside methods, so the
  rest of the API keeps working (and the package keeps importing) on a host
  where the ML extras aren't installed — the predictor just returns ``None`` and
  the caller uses the heuristic fallback.

Persistence layout (under ``DEPORTE_MODEL_ROOT`` / default ``./ml_models``):
    injury_risk.ubj        # XGBoost native binary (portable, versioned)
    injury_risk.meta.json  # feature names, metrics, version, provenance
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from .features import FEATURE_NAMES

MODEL_VERSION = "xgb-1.0.0"
_MODEL_BASENAME = "injury_risk"

# Production-reasonable defaults for a few-thousand-row tabular problem:
# shallow trees + strong regularisation to resist overfitting on a small,
# noisy medical signal. Overridable via train(params=...).
_DEFAULT_PARAMS: Dict[str, object] = {
    "n_estimators": 400,
    "max_depth": 4,
    "learning_rate": 0.03,
    "subsample": 0.85,
    "colsample_bytree": 0.85,
    "min_child_weight": 6.0,
    "reg_lambda": 1.5,
    "reg_alpha": 0.0,
    "gamma": 0.0,
    "objective": "binary:logistic",
    "eval_metric": "auc",
    "tree_method": "hist",
    "n_jobs": 0,
}


def default_model_dir() -> Path:
    """Where trained models live. Gitignored; overridable via env for deploys."""
    return Path(os.getenv("DEPORTE_MODEL_ROOT", "./ml_models"))


class FeatureMismatch(RuntimeError):
    """Saved model's feature contract differs from the current code."""


@dataclass
class TrainMetrics:
    n_samples: int
    n_features: int
    positive_rate: float
    auc: Optional[float] = None
    average_precision: Optional[float] = None
    brier: Optional[float] = None
    n_estimators_used: Optional[int] = None

    def to_dict(self) -> Dict[str, object]:
        return {k: v for k, v in self.__dict__.items()}


@dataclass
class InjuryRiskModel:
    """Trained model + explainer wrapper. Construct via :meth:`train`/:meth:`load`."""

    clf: object  # xgboost.XGBClassifier (typed loosely to keep import lazy)
    feature_names: List[str] = field(default_factory=lambda: list(FEATURE_NAMES))
    version: str = MODEL_VERSION
    trained_on: str = "unknown"          # "synthetic" | "club-history"
    trained_at: Optional[str] = None
    metrics: Dict[str, object] = field(default_factory=dict)
    _explainer: object = field(default=None, repr=False)

    # -- lazy deps -----------------------------------------------------------
    @staticmethod
    def _xgb():
        import xgboost as xgb  # noqa: WPS433 (intentional lazy import)
        return xgb

    # -- training ------------------------------------------------------------
    @classmethod
    def train(
        cls,
        X: np.ndarray,
        y: np.ndarray,
        *,
        feature_names: Optional[List[str]] = None,
        params: Optional[Dict[str, object]] = None,
        val_split: float = 0.2,
        trained_on: str = "unknown",
        seed: int = 42,
    ) -> "InjuryRiskModel":
        """Fit an XGBoost classifier and return a ready-to-use model.

        Uses a stratified validation split for early stopping and honest
        metrics. Handles class imbalance via ``scale_pos_weight``.
        """
        xgb = cls._xgb()
        from sklearn.metrics import (
            average_precision_score,
            brier_score_loss,
            roc_auc_score,
        )
        from sklearn.model_selection import train_test_split

        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        names = list(feature_names or FEATURE_NAMES)
        if X.shape[1] != len(names):
            raise ValueError(
                f"X has {X.shape[1]} columns but {len(names)} feature names given"
            )

        n_pos = int(y.sum())
        n_neg = int(len(y) - n_pos)
        merged = dict(_DEFAULT_PARAMS)
        if params:
            merged.update(params)
        merged["random_state"] = seed
        if n_pos > 0:
            merged["scale_pos_weight"] = max(n_neg / n_pos, 1.0)

        # Only attempt a validation split if both classes can be represented.
        can_split = (
            n_pos >= 2 and n_neg >= 2 and 0.0 < val_split < 0.5 and len(y) >= 20
        )
        metrics = TrainMetrics(
            n_samples=int(len(y)),
            n_features=int(X.shape[1]),
            positive_rate=round(n_pos / len(y), 4) if len(y) else 0.0,
        )

        if can_split:
            X_tr, X_val, y_tr, y_val = train_test_split(
                X, y, test_size=val_split, random_state=seed, stratify=y
            )
            clf = xgb.XGBClassifier(early_stopping_rounds=40, **merged)
            clf.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
            proba = clf.predict_proba(X_val)[:, 1]
            try:
                metrics.auc = round(float(roc_auc_score(y_val, proba)), 4)
                metrics.average_precision = round(
                    float(average_precision_score(y_val, proba)), 4
                )
                metrics.brier = round(float(brier_score_loss(y_val, proba)), 4)
            except ValueError:
                pass
            best_it = getattr(clf, "best_iteration", None)
            metrics.n_estimators_used = (
                int(best_it) + 1 if best_it is not None else int(merged["n_estimators"])
            )
        else:
            clf = xgb.XGBClassifier(**merged)
            clf.fit(X, y)
            metrics.n_estimators_used = int(merged["n_estimators"])

        return cls(
            clf=clf,
            feature_names=names,
            trained_on=trained_on,
            trained_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            metrics=metrics.to_dict(),
        )

    @classmethod
    def bootstrap_synthetic(
        cls, n: int = 4000, *, seed: int = 42
    ) -> "InjuryRiskModel":
        """Train a cold-start model on the synthetic generator. Clearly tagged."""
        from .synthetic import generate

        X, y = generate(n=n, seed=seed)
        return cls.train(X, y, trained_on="synthetic", seed=seed)

    # -- inference -----------------------------------------------------------
    def _as_2d(self, X) -> np.ndarray:
        arr = np.asarray(X, dtype=float)
        return arr.reshape(1, -1) if arr.ndim == 1 else arr

    def predict_proba(self, X) -> np.ndarray:
        """Injury probability in [0, 1] for each row."""
        arr = self._as_2d(X)
        return self.clf.predict_proba(arr)[:, 1]

    def shap_values(self, X) -> Tuple[np.ndarray, float]:
        """Return ``(values, base)`` in log-odds (margin) space.

        ``values`` is ``(n, n_features)``; ``base`` is the explainer's expected
        margin. Prefers the ``shap`` package; falls back to XGBoost's exact
        ``pred_contribs`` if shap isn't importable.
        """
        arr = self._as_2d(X)
        try:
            import shap  # noqa: WPS433

            if self._explainer is None:
                self._explainer = shap.TreeExplainer(self.clf)
            values = np.asarray(self._explainer.shap_values(arr))
            # Binary classifiers may return a list [class0, class1] in old shap.
            if values.ndim == 3:
                values = values[..., 1] if values.shape[-1] == 2 else values[1]
            base = self._explainer.expected_value
            base = float(np.asarray(base).ravel()[-1])
            return values, base
        except Exception:
            # Exact TreeSHAP straight from the booster — no shap dependency.
            xgb = self._xgb()
            booster = self.clf.get_booster()
            dm = xgb.DMatrix(arr, missing=np.nan)
            contribs = np.asarray(booster.predict(dm, pred_contribs=True))
            return contribs[:, :-1], float(contribs[0, -1])

    # -- persistence ---------------------------------------------------------
    def save(self, model_dir: Optional[Path] = None) -> Path:
        d = Path(model_dir or default_model_dir())
        d.mkdir(parents=True, exist_ok=True)
        model_path = d / f"{_MODEL_BASENAME}.ubj"
        self.clf.save_model(str(model_path))
        meta = {
            "version": self.version,
            "feature_names": self.feature_names,
            "trained_on": self.trained_on,
            "trained_at": self.trained_at,
            "metrics": self.metrics,
        }
        (d / f"{_MODEL_BASENAME}.meta.json").write_text(
            json.dumps(meta, indent=2), encoding="utf-8"
        )
        return model_path

    @classmethod
    def load(cls, model_dir: Optional[Path] = None) -> "InjuryRiskModel":
        d = Path(model_dir or default_model_dir())
        model_path = d / f"{_MODEL_BASENAME}.ubj"
        meta_path = d / f"{_MODEL_BASENAME}.meta.json"
        if not model_path.exists() or not meta_path.exists():
            raise FileNotFoundError(f"No trained injury model under {d}")

        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        saved_names = meta.get("feature_names", [])
        if saved_names != FEATURE_NAMES:
            raise FeatureMismatch(
                "Saved model feature contract differs from current code; "
                "retrain required."
            )

        xgb = cls._xgb()
        clf = xgb.XGBClassifier()
        clf.load_model(str(model_path))
        return cls(
            clf=clf,
            feature_names=saved_names,
            version=meta.get("version", MODEL_VERSION),
            trained_on=meta.get("trained_on", "unknown"),
            trained_at=meta.get("trained_at"),
            metrics=meta.get("metrics", {}),
        )
