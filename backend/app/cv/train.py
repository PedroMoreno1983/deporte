"""Fine-tune the YOLO player/ball detector and publish a versioned checkpoint.

Run as a one-off / scheduled ops command::

    # Real fine-tune on a YOLO-format football dataset:
    python -m app.cv.train --data /data/datasets/soccernet/data.yaml --epochs 80

    # Resume from / start at a specific base:
    python -m app.cv.train --data data.yaml --base yolov8s.pt --imgsz 1280

    # Wiring smoke-test (toy synthetic dataset, 1 epoch, no network/GPU):
    python -m app.cv.train --smoke

Getting a real dataset
----------------------
This module ships the *trainer*, not the *labels*. To fine-tune for real,
export a football dataset to **YOLO detection format** — a ``data.yaml`` next to
``images/{train,val}`` and ``labels/{train,val}`` — and point ``--data`` at it:

* **SoccerNet** (https://www.soccer-net.org) provides player bounding boxes;
  convert its annotations to YOLO format (one ``<cls> <cx> <cy> <w> <h>`` line
  per box, normalised 0-1).
* The Roboflow *football-players-detection* set is already YOLO-formatted with
  classes ``[ball, goalkeeper, player, referee]`` — the schema this project
  treats as canonical (see :data:`app.cv.labels.FOOTBALL_CLASSES`).

Honesty note: the ``--smoke`` model is a wiring check trained on generated
rectangles. It proves train → locate-best → publish-sidecar works end to end;
it is **not** a usable detector. Detection quality requires the real dataset.

Output
------
The best checkpoint is published to :func:`app.cv.model_loader.cv_model_dir`
as ``players.pt`` with a ``players.meta.json`` sidecar (class names, base
model, dataset, epochs, validation metrics, timestamp). The pipeline's loader
auto-discovers it on the next analysis — no code change, no redeploy.
"""
from __future__ import annotations

import argparse
import json
import logging
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .labels import FOOTBALL_CLASSES, ClassSchema
from .model_loader import BASE_WEIGHTS, FINETUNED_BASENAME, cv_model_dir, sidecar_path_for

log = logging.getLogger("cv.train")


# ── dataset helpers ──────────────────────────────────────────────────────────
def _write_data_yaml(root: Path, names: List[str]) -> Path:
    """Write a minimal YOLO ``data.yaml`` (hand-rolled — no PyYAML dependency)."""
    lines = [
        f"path: {root.as_posix()}",
        "train: images/train",
        "val: images/val",
        "names:",
        *[f"  {i}: {name}" for i, name in enumerate(names)],
        "",
    ]
    data_yaml = root / "data.yaml"
    data_yaml.write_text("\n".join(lines), encoding="utf-8")
    return data_yaml


def make_synthetic_dataset(
    root: Path,
    *,
    n_train: int = 16,
    n_val: int = 4,
    imgsz: int = 320,
    seed: int = 0,
) -> Path:
    """Generate a tiny YOLO-format dataset of coloured rectangles ("players")
    and a small circle ("ball") on a green field.

    Purpose is to exercise the *training wiring*, not to teach anything useful.
    Uses cv2/numpy (present whenever ultralytics is) lazily so this module
    imports without the CV stack.
    """
    import cv2
    import numpy as np

    rng = np.random.default_rng(seed)
    root = Path(root)
    names = FOOTBALL_CLASSES  # [ball, goalkeeper, player, referee]
    ball_id = names.index("ball")
    person_ids = [names.index("player"), names.index("goalkeeper"), names.index("referee")]

    for split, n in (("train", n_train), ("val", n_val)):
        img_dir = root / "images" / split
        lbl_dir = root / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        for i in range(n):
            # Green pitch with slight noise so it's not a constant image.
            img = np.full((imgsz, imgsz, 3), (40, 110, 40), dtype=np.uint8)
            img = (img + rng.integers(0, 12, img.shape, dtype=np.uint8))
            rows: List[str] = []

            # 3-6 "people": coloured vertical rectangles.
            for _ in range(int(rng.integers(3, 7))):
                w = int(rng.integers(imgsz * 0.04, imgsz * 0.09))
                h = int(rng.integers(imgsz * 0.12, imgsz * 0.22))
                cx = int(rng.integers(w, imgsz - w))
                cy = int(rng.integers(h, imgsz - h))
                color = tuple(int(c) for c in rng.integers(60, 255, 3))
                cv2.rectangle(img, (cx - w // 2, cy - h // 2), (cx + w // 2, cy + h // 2), color, -1)
                cls = int(rng.choice(person_ids))
                rows.append(f"{cls} {cx/imgsz:.6f} {cy/imgsz:.6f} {w/imgsz:.6f} {h/imgsz:.6f}")

            # One "ball": small white circle.
            br = max(2, int(imgsz * 0.02))
            bx = int(rng.integers(br, imgsz - br))
            by = int(rng.integers(br, imgsz - br))
            cv2.circle(img, (bx, by), br, (245, 245, 245), -1)
            rows.append(f"{ball_id} {bx/imgsz:.6f} {by/imgsz:.6f} {2*br/imgsz:.6f} {2*br/imgsz:.6f}")

            cv2.imwrite(str(img_dir / f"{split}_{i:03d}.jpg"), img)
            (lbl_dir / f"{split}_{i:03d}.txt").write_text("\n".join(rows) + "\n", encoding="utf-8")

    return _write_data_yaml(root, names)


# ── training ─────────────────────────────────────────────────────────────────
def _locate_best(model, project: Path) -> Path:
    """Find the ``best.pt`` ultralytics wrote for this run."""
    trainer = getattr(model, "trainer", None)
    best = getattr(trainer, "best", None) if trainer is not None else None
    if best and Path(best).exists():
        return Path(best)
    candidates = sorted(Path(project).rglob("best.pt"), key=lambda p: p.stat().st_mtime)
    if candidates:
        return candidates[-1]
    raise FileNotFoundError("training finished but produced no best.pt")


def _val_metrics(results) -> Dict[str, float]:
    """Pull the headline validation metrics out of ultralytics' results object."""
    rd = getattr(results, "results_dict", None) or {}
    wanted = {
        "metrics/mAP50(B)": "mAP50",
        "metrics/mAP50-95(B)": "mAP50_95",
        "metrics/precision(B)": "precision",
        "metrics/recall(B)": "recall",
    }
    out: Dict[str, float] = {}
    for raw, nice in wanted.items():
        if raw in rd:
            try:
                out[nice] = round(float(rd[raw]), 4)
            except (TypeError, ValueError):
                pass
    return out


def publish_checkpoint(
    best_pt: Path,
    names,
    *,
    base: str,
    epochs: int,
    dataset: str,
    metrics: Optional[Dict[str, float]] = None,
    model_dir: Optional[Path] = None,
) -> Path:
    """Copy ``best.pt`` to ``<model_dir>/players.pt`` and write its sidecar.

    The sidecar records the class schema and provenance so the loader knows the
    role↔id mapping without loading the (heavy) weights.
    """
    dest_dir = Path(model_dir or cv_model_dir())
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{FINETUNED_BASENAME}.pt"
    shutil.copy2(best_pt, dest)

    schema = ClassSchema.from_names(names)
    meta = {
        "names": schema.to_dict(),
        "roles": {str(cid): schema.role_of(cid) for cid in sorted(schema.names)},
        "base": base,
        "epochs": epochs,
        "dataset": str(dataset),
        "metrics": metrics or {},
        "source": "finetune",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    sidecar_path_for(dest).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return dest


def finetune(
    data_yaml: str | Path,
    *,
    base: str = BASE_WEIGHTS,
    epochs: int = 50,
    imgsz: int = 640,
    batch: int = 16,
    device: Optional[str] = None,
    run_dir: Optional[Path] = None,
    model_dir: Optional[Path] = None,
) -> Dict[str, object]:
    """Fine-tune ``base`` on ``data_yaml`` and publish the best checkpoint.

    Returns a summary dict ``{ok, weights, classes, metrics, epochs, base}``.
    Raises on a genuine training failure (don't pretend success).
    """
    from ultralytics import YOLO  # lazy: pulls torch + ultralytics

    data_yaml = Path(data_yaml)
    if not data_yaml.exists():
        raise FileNotFoundError(f"data.yaml not found: {data_yaml}")

    project = Path(run_dir or (cv_model_dir() / "runs"))
    project.mkdir(parents=True, exist_ok=True)

    log.info("Fine-tuning %s on %s for %d epochs (imgsz=%d)…", base, data_yaml, epochs, imgsz)
    model = YOLO(base)
    results = model.train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        project=str(project),
        name="finetune",
        exist_ok=True,
        verbose=False,
        plots=False,
    )

    best = _locate_best(model, project)
    metrics = _val_metrics(results)
    dest = publish_checkpoint(
        best,
        getattr(model, "names", None) or {},
        base=base,
        epochs=epochs,
        dataset=str(data_yaml),
        metrics=metrics,
        model_dir=model_dir,
    )

    return {
        "ok": True,
        "weights": str(dest),
        "classes": ClassSchema.from_names(getattr(model, "names", None) or {}).to_dict(),
        "metrics": metrics,
        "epochs": epochs,
        "base": base,
    }


# ── CLI ──────────────────────────────────────────────────────────────────────
def main(argv: Optional[list] = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    parser = argparse.ArgumentParser(description="Fine-tune the YOLO player/ball detector")
    parser.add_argument("--data", default=None, help="path to a YOLO data.yaml")
    parser.add_argument("--base", default=BASE_WEIGHTS, help="base weights to fine-tune from")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default=None, help="e.g. 'cpu', '0', '0,1' (default: auto)")
    parser.add_argument("--smoke", action="store_true",
                        help="generate a toy synthetic dataset and run 1 epoch (wiring check)")
    parser.add_argument("--n-synth", type=int, default=16, help="synthetic train images for --smoke")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)

    if not args.data and not args.smoke:
        parser.error("provide --data <data.yaml> (a YOLO-format dataset) or --smoke")

    tmp_root: Optional[Path] = None
    try:
        if args.smoke:
            print("Smoke mode: generating a toy synthetic dataset (wiring check only)…")
            print("  NOTE: the resulting model is NOT a usable detector.")
            tmp_root = Path(tempfile.mkdtemp(prefix="cv_smoke_"))
            data_yaml = make_synthetic_dataset(tmp_root, n_train=args.n_synth, imgsz=320, seed=args.seed)
            summary = finetune(
                data_yaml, base=args.base, epochs=1, imgsz=320, batch=4, device=args.device or "cpu",
            )
        else:
            summary = finetune(
                args.data, base=args.base, epochs=args.epochs,
                imgsz=args.imgsz, batch=args.batch, device=args.device,
            )
    finally:
        if tmp_root and tmp_root.exists():
            shutil.rmtree(tmp_root, ignore_errors=True)

    print("\nPublished fine-tuned detector")
    print(f"  weights:  {summary['weights']}")
    print(f"  classes:  {summary['classes']}")
    print(f"  metrics:  {summary['metrics']}")
    print(f"  base:     {summary['base']}  epochs: {summary['epochs']}")
    print(f"  dir:      {cv_model_dir().resolve()}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
