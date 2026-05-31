"""Checkpoint resolution priority + sidecar parsing.

Exercises which weights the pipeline picks WITHOUT loading YOLO — pure path /
filesystem / JSON logic, so it always runs.
"""
from __future__ import annotations

import json

from app.cv.model_loader import (
    BASE_WEIGHTS,
    ResolvedWeights,
    cv_model_dir,
    resolve_weights,
    sidecar_path_for,
)


def _clear_env(monkeypatch):
    for var in ("DEPORTE_YOLO_CKPT", "DEPORTE_CV_MODEL_ROOT", "DEPORTE_CV_ROOT"):
        monkeypatch.delenv(var, raising=False)


def _write_finetuned(model_dir, names):
    model_dir.mkdir(parents=True, exist_ok=True)
    weights = model_dir / "players.pt"
    weights.write_bytes(b"\x00")  # resolver only stats existence, never loads
    sidecar = sidecar_path_for(weights)
    sidecar.write_text(json.dumps({"names": names, "source": "finetune"}), encoding="utf-8")
    return weights


# ── priority order ────────────────────────────────────────────────────────────
def test_explicit_weights_win(monkeypatch, tmp_path):
    _clear_env(monkeypatch)
    monkeypatch.setenv("DEPORTE_YOLO_CKPT", "from-env.pt")
    _write_finetuned(tmp_path / "models", {0: "player"})
    monkeypatch.setenv("DEPORTE_CV_MODEL_ROOT", str(tmp_path / "models"))

    r = resolve_weights("/explicit/custom.pt")
    assert r.source == "explicit"
    assert r.path == "/explicit/custom.pt"


def test_env_beats_disk_and_base(monkeypatch, tmp_path):
    _clear_env(monkeypatch)
    monkeypatch.setenv("DEPORTE_YOLO_CKPT", "pinned.pt")
    r = resolve_weights()
    assert r.source == "env"
    assert r.path == "pinned.pt"
    assert r.is_finetuned is False  # no sidecar next to it


def test_finetuned_on_disk_is_discovered(monkeypatch, tmp_path):
    _clear_env(monkeypatch)
    models = tmp_path / "models"
    _write_finetuned(models, {0: "ball", 1: "goalkeeper", 2: "player", 3: "referee"})
    monkeypatch.setenv("DEPORTE_CV_MODEL_ROOT", str(models))

    r = resolve_weights()
    assert r.source == "finetuned"
    assert r.is_finetuned is True
    assert r.path.endswith("players.pt")
    # Sidecar names are parsed and exposed as a ClassSchema.
    assert r.class_names == {0: "ball", 1: "goalkeeper", 2: "player", 3: "referee"}
    schema = r.schema
    assert schema is not None
    assert schema.player_class_ids == {2}
    assert schema.person_class_ids == {1, 2, 3}


def test_base_fallback_when_nothing_configured(monkeypatch, tmp_path):
    _clear_env(monkeypatch)
    # Point the model dir at an empty location so discovery finds nothing.
    monkeypatch.setenv("DEPORTE_CV_MODEL_ROOT", str(tmp_path / "empty"))
    r = resolve_weights()
    assert r.source == "base"
    assert r.path == BASE_WEIGHTS
    assert r.is_finetuned is False
    assert r.schema is None


def test_explicit_path_with_sidecar_is_marked_finetuned(monkeypatch, tmp_path):
    _clear_env(monkeypatch)
    weights = _write_finetuned(tmp_path / "custom", {0: "player", 1: "ball"})
    r = resolve_weights(str(weights))
    assert r.source == "explicit"
    assert r.is_finetuned is True
    assert r.class_names == {0: "player", 1: "ball"}


# ── helpers ───────────────────────────────────────────────────────────────────
def test_sidecar_path_naming():
    assert sidecar_path_for("/a/b/players.pt").name == "players.meta.json"


def test_cv_model_dir_env_precedence(monkeypatch, tmp_path):
    _clear_env(monkeypatch)
    # 1. explicit model root
    monkeypatch.setenv("DEPORTE_CV_MODEL_ROOT", str(tmp_path / "m"))
    assert cv_model_dir() == tmp_path / "m"
    # 2. derived from CV root
    monkeypatch.delenv("DEPORTE_CV_MODEL_ROOT", raising=False)
    monkeypatch.setenv("DEPORTE_CV_ROOT", str(tmp_path / "cv"))
    assert cv_model_dir() == tmp_path / "cv" / "models"


def test_resolved_weights_dataclass_defaults():
    r = ResolvedWeights(path="x.pt", source="base", is_finetuned=False)
    assert r.class_names is None
    assert r.meta == {}
    assert r.schema is None
