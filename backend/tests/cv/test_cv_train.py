"""Fine-tuner: checkpoint publishing (pure) and the real train→publish smoke
test (skipped unless ultralytics is installed).
"""
from __future__ import annotations

import json

import pytest

from app.cv.model_loader import resolve_weights
from app.cv.train import publish_checkpoint


# ── publishing (pure: shutil + json, no CV stack) ─────────────────────────────
def test_publish_checkpoint_writes_weights_and_sidecar(tmp_path):
    best = tmp_path / "run" / "best.pt"
    best.parent.mkdir(parents=True)
    best.write_bytes(b"weights-bytes")

    dest = publish_checkpoint(
        best,
        {0: "ball", 1: "goalkeeper", 2: "player", 3: "referee"},
        base="yolov8n.pt",
        epochs=7,
        dataset="/data/soccernet/data.yaml",
        metrics={"mAP50": 0.42},
        model_dir=tmp_path / "models",
    )

    assert dest.name == "players.pt"
    assert dest.read_bytes() == b"weights-bytes"     # real copy of best.pt

    meta = json.loads((tmp_path / "models" / "players.meta.json").read_text())
    assert meta["names"] == {"0": "ball", "1": "goalkeeper", "2": "player", "3": "referee"}
    assert meta["roles"]["2"] == "player"
    assert meta["roles"]["0"] == "ball"
    assert meta["base"] == "yolov8n.pt"
    assert meta["epochs"] == 7
    assert meta["dataset"].endswith("data.yaml")
    assert meta["metrics"] == {"mAP50": 0.42}
    assert meta["source"] == "finetune"
    assert meta["trained_at"]                         # ISO timestamp present


def test_published_checkpoint_is_then_resolved(tmp_path, monkeypatch):
    """End-to-end of the contract between train.publish and loader.resolve."""
    for var in ("DEPORTE_YOLO_CKPT", "DEPORTE_CV_ROOT"):
        monkeypatch.delenv(var, raising=False)

    best = tmp_path / "best.pt"
    best.write_bytes(b"\x00")
    publish_checkpoint(
        best,
        {0: "ball", 1: "goalkeeper", 2: "player", 3: "referee"},
        base="yolov8n.pt", epochs=1, dataset="x", model_dir=tmp_path / "models",
    )
    monkeypatch.setenv("DEPORTE_CV_MODEL_ROOT", str(tmp_path / "models"))

    r = resolve_weights()
    assert r.source == "finetuned"
    assert r.is_finetuned is True
    assert r.schema.player_class_ids == {2}
    assert r.schema.ball_class_ids == {0}


# ── synthetic dataset generator (needs opencv) ────────────────────────────────
def test_make_synthetic_dataset_layout(tmp_path):
    pytest.importorskip("cv2")
    from app.cv.train import make_synthetic_dataset

    data_yaml = make_synthetic_dataset(tmp_path, n_train=3, n_val=2, imgsz=64, seed=1)
    assert data_yaml.exists()
    text = data_yaml.read_text(encoding="utf-8")
    assert "names:" in text and "player" in text and "ball" in text

    imgs = sorted((tmp_path / "images" / "train").glob("*.jpg"))
    lbls = sorted((tmp_path / "labels" / "train").glob("*.txt"))
    assert len(imgs) == 3 and len(lbls) == 3
    assert len(list((tmp_path / "images" / "val").glob("*.jpg"))) == 2

    for lbl in lbls:
        for line in lbl.read_text().splitlines():
            parts = line.split()
            assert len(parts) == 5                    # cls cx cy w h
            assert 0 <= int(parts[0]) <= 3
            assert all(0.0 <= float(v) <= 1.0 for v in parts[1:])


# ── real fine-tune (skipped unless ultralytics present) ───────────────────────
def test_smoke_finetune_publishes_usable_artifact(tmp_path, monkeypatch):
    """The full --smoke path: generate toy data, train 1 epoch, publish + sidecar.

    Heavy (pulls torch); only runs where ultralytics is installed.
    """
    pytest.importorskip("ultralytics")
    monkeypatch.setenv("DEPORTE_CV_MODEL_ROOT", str(tmp_path / "models"))

    from app.cv import train

    rc = train.main(["--smoke", "--n-synth", "6"])
    assert rc == 0

    dest = tmp_path / "models" / "players.pt"
    assert dest.exists(), "smoke fine-tune did not publish players.pt"
    meta = json.loads((tmp_path / "models" / "players.meta.json").read_text())
    assert meta["names"] == {"0": "ball", "1": "goalkeeper", "2": "player", "3": "referee"}
    assert meta["source"] == "finetune"

    # And the loader picks it up unprompted.
    monkeypatch.delenv("DEPORTE_YOLO_CKPT", raising=False)
    r = resolve_weights()
    assert r.source == "finetuned" and r.is_finetuned
