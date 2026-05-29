"""Serving layer: turn a trained model + a player into the API's risk payload.

The public contract that the rest of the platform depends on is unchanged::

    {
      "score":  float,                 # 0–100
      "level":  "low|medium|high|critical",
      "factors": { key: {label, value, contribution, description, ...} },
    }

So the prediction endpoint, the ``PredictionScore`` row and the frontend keep
working whether the number comes from this model or the heuristic fallback.

SHAP → ``factors`` mapping
--------------------------
SHAP values are per-feature contributions in **log-odds** space that sum to the
model's margin. To keep the existing UI semantics (risk-increasing factors whose
points roughly add up to the score) we:

  * keep the signed raw SHAP value (``shap``) and a ``direction`` for honesty,
  * project each factor's share of the total *positive* push onto the 0–100
    score as ``contribution`` (protective factors get a negative contribution),
  * surface the top factors by absolute impact.

All values are coerced to native Python types so the payload is JSON / DB-JSON
serialisable (raw numpy floats are not).
"""
from __future__ import annotations

import logging
import math
import os
import threading
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from ...models.player import Player
from ..injury_risk import get_risk_level
from .features import FEATURE_LABELS, FEATURE_NAMES, FeatureExtractor
from .model import InjuryRiskModel, default_model_dir

logger = logging.getLogger(__name__)

# Number of factors surfaced in the payload (matches the heuristic's ~5-6).
_TOP_FACTORS = 8

# Process-wide model cache, refreshed when the file on disk changes (so a
# retrain/redeploy is picked up without a restart). Guarded for thread-safety
# under the threaded ASGI server.
_lock = threading.Lock()
_cache: Dict[str, object] = {"mtime": None, "model": None, "checked_missing": False}


def _model_mtime() -> Optional[float]:
    path = Path(default_model_dir()) / "injury_risk.ubj"
    try:
        return path.stat().st_mtime
    except OSError:
        return None


def get_model() -> Optional[InjuryRiskModel]:
    """Return the cached trained model, or ``None`` if unavailable.

    ``None`` is returned when: no model file exists, the ML extras
    (xgboost/shap) aren't installed, or the saved feature contract no longer
    matches the code. Any of these makes the caller fall back to the heuristic.
    """
    mtime = _model_mtime()
    if mtime is None:
        return None
    with _lock:
        if _cache["model"] is not None and _cache["mtime"] == mtime:
            return _cache["model"]  # type: ignore[return-value]
        try:
            model = InjuryRiskModel.load()
        except Exception as exc:  # FileNotFound, FeatureMismatch, missing deps
            logger.warning("Injury model unavailable, using heuristic: %s", exc)
            _cache["model"], _cache["mtime"] = None, mtime
            return None
        _cache["model"], _cache["mtime"] = model, mtime
        return model


def reset_cache() -> None:
    """Drop the cached model (used by tests after writing a fresh model)."""
    with _lock:
        _cache["model"], _cache["mtime"] = None, None


def _jsonable(value):
    """Coerce numpy / NaN to JSON-safe native types."""
    if value is None:
        return None
    if isinstance(value, (bool, int, str)):
        return value
    try:
        f = float(value)
    except (TypeError, ValueError):
        return value
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f, 4)


def _describe(label: str, raw_value, direction: str) -> str:
    val = _jsonable(raw_value)
    val_txt = "sin dato" if val is None else val
    if direction == "up":
        return f"{label} (valor: {val_txt}) está empujando el riesgo al alza."
    return f"{label} (valor: {val_txt}) está reduciendo el riesgo."


def _build_factors(
    feats: Dict[str, float],
    shap_values: List[float],
    score: float,
) -> Dict[str, Dict[str, object]]:
    """Map per-feature SHAP values onto the `factors` contract."""
    pairs = list(zip(FEATURE_NAMES, shap_values))
    total_pos = sum(s for _, s in pairs if s > 0) or 1.0

    # Rank by absolute impact, keep the most influential factors.
    pairs.sort(key=lambda kv: abs(kv[1]), reverse=True)
    top = [(n, s) for n, s in pairs if abs(s) > 1e-4][:_TOP_FACTORS]

    factors: Dict[str, Dict[str, object]] = {}
    for name, shap_val in top:
        direction = "up" if shap_val > 0 else "down"
        # Project share of the positive push onto the 0–100 score; protective
        # factors keep their negative sign so the UI can render them downward.
        contribution = round(score * (shap_val / total_pos), 1)
        factors[name] = {
            "label": FEATURE_LABELS.get(name, name),
            "value": _jsonable(feats.get(name)),
            "contribution": contribution,
            "description": _describe(FEATURE_LABELS.get(name, name), feats.get(name), direction),
            "shap": _jsonable(shap_val),
            "direction": direction,
        }
    return factors


def predict_risk(player_id: int, db: Session) -> Optional[Dict[str, object]]:
    """Model-backed injury risk for a player, or ``None`` to signal fallback.

    Returns ``None`` (rather than raising) whenever the model can't produce a
    trustworthy answer, so :func:`app.ml.injury_risk.calculate_injury_risk` can
    cleanly fall back to the heuristic.
    """
    model = get_model()
    if model is None:
        return None

    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        return None

    extractor = FeatureExtractor()
    feats = extractor.extract(db, player, date.today())
    vector = [float(feats[name]) for name in FEATURE_NAMES]

    proba = float(model.predict_proba([vector])[0])
    score = round(min(max(proba * 100.0, 0.0), 100.0), 1)

    try:
        shap_matrix, _base = model.shap_values([vector])
        shap_row = [float(v) for v in list(shap_matrix[0])]
        factors = _build_factors(feats, shap_row, score)
    except Exception as exc:  # explanation failure must not break scoring
        logger.warning("SHAP explanation failed, returning score only: %s", exc)
        factors = {}

    return {
        "score": score,
        "level": get_risk_level(score),
        "factors": factors,
        "method": "model",
        "model_version": model.version,
        "model_trained_on": model.trained_on,
    }
