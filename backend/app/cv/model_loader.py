"""Checkpoint resolution + detector construction.

Decides *which* YOLO weights the pipeline runs with, in priority order, and
loads the matching :class:`~app.cv.labels.ClassSchema` so the rest of the
pipeline is class-id agnostic.

Resolution order (first hit wins)
---------------------------------
1. an explicit ``weights=`` argument (a request asked for a specific model);
2. the ``DEPORTE_YOLO_CKPT`` env var (a deployment pinned one);
3. a fine-tuned checkpoint discovered on disk under :func:`cv_model_dir`
   (``players.pt`` + ``players.meta.json`` sidecar, written by ``train.py``);
4. the stock ``yolov8n.pt`` base model (ultralytics downloads it on first use).

Only step 3 requires the file to already exist — steps 1/2/4 may name a model
ultralytics resolves/downloads lazily, so we don't stat them.

A fine-tuned checkpoint carries a ``*.meta.json`` sidecar with its class names,
so the pipeline knows the role↔id mapping *before* the (heavy) model loads.
When there's no sidecar the schema is read from ``model.names`` after load.

Importable without the CV stack: ultralytics/torch are only touched inside
:func:`load_detector` (which in turn imports the lazy :class:`YoloDetector`).
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

from .labels import ClassSchema

log = logging.getLogger("cv.model_loader")

# Stock COCO model ultralytics ships/downloads by name.
BASE_WEIGHTS = "yolov8n.pt"
# Basename of a fine-tuned checkpoint produced by train.py (`<name>.pt` +
# `<name>.meta.json`).
FINETUNED_BASENAME = "players"


def cv_model_dir() -> Path:
    """Where fine-tuned CV checkpoints live.

    Honours ``DEPORTE_CV_MODEL_ROOT`` if set, else ``<DEPORTE_CV_ROOT>/models``
    (default ``./cv_data/models``). Gitignored; the prod image mounts it on a
    named volume so a trained model survives container restarts.
    """
    explicit = os.getenv("DEPORTE_CV_MODEL_ROOT")
    if explicit:
        return Path(explicit)
    return Path(os.getenv("DEPORTE_CV_ROOT", "./cv_data")) / "models"


def sidecar_path_for(weights_path: str | Path) -> Path:
    """``foo/players.pt`` → ``foo/players.meta.json``."""
    return Path(weights_path).with_suffix(".meta.json")


@dataclass
class ResolvedWeights:
    """The outcome of :func:`resolve_weights` — a path plus what we know about it."""

    path: str
    source: str                 # "explicit" | "env" | "finetuned" | "base"
    is_finetuned: bool
    class_names: Optional[Dict[int, str]] = None   # from sidecar, if any
    meta: Dict[str, Any] = field(default_factory=dict)

    @property
    def schema(self) -> Optional[ClassSchema]:
        """Class schema from the sidecar, or ``None`` (read from model.names)."""
        return ClassSchema.from_names(self.class_names) if self.class_names else None


def _read_sidecar(weights_path: str | Path) -> Optional[dict]:
    p = sidecar_path_for(weights_path)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        log.warning("Ignoring unreadable sidecar %s: %s", p, exc)
        return None


def _resolve_known(path: str, source: str) -> ResolvedWeights:
    """Wrap a chosen path, attaching sidecar metadata if it's present on disk."""
    meta = _read_sidecar(path) or {}
    names = meta.get("names")
    class_names = {int(k): str(v) for k, v in names.items()} if names else None
    # Fine-tuned if we auto-discovered it, or if it carries a football sidecar.
    is_ft = source == "finetuned" or bool(class_names)
    return ResolvedWeights(
        path=str(path),
        source=source,
        is_finetuned=is_ft,
        class_names=class_names,
        meta=meta,
    )


def resolve_weights(explicit: Optional[str] = None) -> ResolvedWeights:
    """Pick the checkpoint to run with (see module docstring for the order)."""
    if explicit:
        return _resolve_known(explicit, "explicit")

    env = os.getenv("DEPORTE_YOLO_CKPT")
    if env:
        return _resolve_known(env, "env")

    finetuned = cv_model_dir() / f"{FINETUNED_BASENAME}.pt"
    if finetuned.exists():
        log.info("Using fine-tuned checkpoint %s", finetuned)
        return _resolve_known(str(finetuned), "finetuned")

    log.info("No fine-tuned checkpoint found; falling back to base %s", BASE_WEIGHTS)
    return ResolvedWeights(
        path=BASE_WEIGHTS, source="base", is_finetuned=False, class_names=None, meta={}
    )


def load_detector(weights: Optional[str] = None, device: Optional[str] = None):
    """Resolve weights and return a ready :class:`YoloDetector`.

    The heavy import lives here so the module stays importable without the CV
    stack. The returned detector exposes ``.schema`` (a :class:`ClassSchema`)
    that the pipeline uses for class-id-agnostic filtering.
    """
    from .detector import YoloDetector  # lazy: pulls ultralytics

    resolved = resolve_weights(weights)
    log.info(
        "Loading detector: path=%s source=%s finetuned=%s",
        resolved.path, resolved.source, resolved.is_finetuned,
    )
    return YoloDetector(
        resolved.path,
        device=device,
        class_names=resolved.class_names,
    )
