"""Train and persist the injury-risk model.

Run as a one-off / scheduled ops command::

    python -m app.ml.injury.train                 # auto: real history else synthetic
    python -m app.ml.injury.train --club-id 1     # restrict to one club's history
    python -m app.ml.injury.train --synthetic     # force the cold-start prior
    python -m app.ml.injury.train --n-synth 6000  # larger synthetic bootstrap

Selection logic
---------------
The trainer prefers the club's **real** injury history (built by
:func:`build_dataset`). It only uses that data when there is enough of it to
fit and honestly validate a model — at least ``--min-samples`` snapshots and
``--min-positives`` injuries in the prediction window. Otherwise it falls back
to the synthetic generator and tags the model ``trained_on="synthetic"`` so the
provenance is explicit in the model metadata and in the serving payload.

The artifact is written to ``DEPORTE_MODEL_ROOT`` (default ``./ml_models``),
which the serving layer hot-reloads on its next request.
"""
from __future__ import annotations

import argparse
import sys
from typing import Optional

import numpy as np

from ...core.database import SessionLocal, ensure_schema
from .dataset import build_dataset
from .model import InjuryRiskModel, default_model_dir
from .predictor import reset_cache


def _try_real_dataset(
    club_id: Optional[int],
    horizon_days: int,
    stride_days: int,
    min_samples: int,
    min_positives: int,
):
    """Build a labelled set from the DB; return (X, y) or None if insufficient."""
    db = SessionLocal()
    try:
        X, y, meta = build_dataset(
            db, club_id=club_id, horizon_days=horizon_days, stride_days=stride_days
        )
    finally:
        db.close()

    if X.shape[0] < min_samples:
        print(f"  real history: {X.shape[0]} snapshots (< {min_samples}) — insufficient")
        return None
    positives = int(y.sum())
    if positives < min_positives:
        print(f"  real history: {positives} positives (< {min_positives}) — insufficient")
        return None
    print(f"  real history: {X.shape[0]} snapshots, {positives} positives — usable")
    return X, y


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(description="Train the injury-risk model")
    parser.add_argument("--club-id", type=int, default=None)
    parser.add_argument("--horizon", type=int, default=28, help="prediction window (days)")
    parser.add_argument("--stride", type=int, default=7, help="snapshot spacing (days)")
    parser.add_argument("--min-samples", type=int, default=200)
    parser.add_argument("--min-positives", type=int, default=25)
    parser.add_argument("--synthetic", action="store_true", help="force synthetic prior")
    parser.add_argument("--n-synth", type=int, default=4000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args(argv)

    # Make sure the schema is reconciled before we query historical tables.
    try:
        ensure_schema()
    except Exception as exc:  # non-fatal for a fresh DB
        print(f"  warning: ensure_schema failed ({exc}); continuing")

    data = None
    if not args.synthetic:
        print("Evaluating real club history…")
        data = _try_real_dataset(
            args.club_id, args.horizon, args.stride, args.min_samples, args.min_positives
        )

    if data is not None:
        X, y = data
        model = InjuryRiskModel.train(X, y, trained_on="club-history", seed=args.seed)
    else:
        print(f"Training synthetic cold-start prior (n={args.n_synth})…")
        print("  NOTE: synthetic model is a sensible prior, NOT clinically validated.")
        model = InjuryRiskModel.bootstrap_synthetic(n=args.n_synth, seed=args.seed)

    path = model.save()
    reset_cache()

    print("\nSaved injury-risk model")
    print(f"  path:        {path}")
    print(f"  dir:         {default_model_dir().resolve()}")
    print(f"  version:     {model.version}")
    print(f"  trained_on:  {model.trained_on}")
    print(f"  metrics:     {model.metrics}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
