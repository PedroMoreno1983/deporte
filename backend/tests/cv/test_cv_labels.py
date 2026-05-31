"""ClassSchema: mapping a checkpoint's raw class names to football roles.

Pure-python — no CV stack needed, so these always run.
"""
from __future__ import annotations

from app.cv.labels import (
    BALL,
    FOOTBALL_CLASSES,
    GOALKEEPER,
    OTHER,
    PLAYER,
    REFEREE,
    ClassSchema,
    default_football_schema,
)


# ── COCO (stock yolov8n) ──────────────────────────────────────────────────────
def test_coco_names_map_person_and_ball():
    s = ClassSchema.from_names({0: "person", 32: "sports ball"})
    assert s.person_class_ids == {0}      # what the original pipeline tracked
    assert s.ball_class_ids == {32}
    assert s.role_of(0) == PLAYER
    assert s.role_of(32) == BALL
    # COCO is not a football-specific fine-tune.
    assert s.is_finetuned_football is False


def test_coco_default_factory():
    s = ClassSchema.coco_default()
    assert s.person_class_ids == {0}
    assert s.ball_class_ids == {32}


# ── football fine-tune (Roboflow / SoccerNet style) ───────────────────────────
def test_football_names_split_into_four_roles():
    s = ClassSchema.from_names({0: "ball", 1: "goalkeeper", 2: "player", 3: "referee"})
    assert s.ball_class_ids == {0}
    assert s.goalkeeper_class_ids == {1}
    assert s.player_class_ids == {2}
    assert s.referee_class_ids == {3}
    # Everyone human gets tracked: player + keeper + referee.
    assert s.person_class_ids == {1, 2, 3}
    assert s.is_finetuned_football is True


def test_player_keyword_wins_over_ball_substring():
    # "football player" contains "ball" — must still classify as PLAYER.
    s = ClassSchema.from_names({0: "football player", 1: "ball"})
    assert s.role_of(0) == PLAYER
    assert s.role_of(1) == BALL
    assert s.ball_class_ids == {1}


def test_spanish_class_names():
    s = ClassSchema.from_names({0: "jugador", 1: "arquero", 2: "árbitro", 3: "pelota"})
    assert s.player_class_ids == {0}
    assert s.goalkeeper_class_ids == {1}
    assert s.referee_class_ids == {2}
    assert s.ball_class_ids == {3}


# ── construction & (de)serialisation ──────────────────────────────────────────
def test_from_names_accepts_a_list():
    s = ClassSchema.from_names(["ball", "goalkeeper", "player", "referee"])
    assert s.names == {0: "ball", 1: "goalkeeper", 2: "player", 3: "referee"}
    assert s.player_class_ids == {2}


def test_to_dict_from_dict_roundtrip():
    s = ClassSchema.from_names({0: "ball", 2: "player"})
    d = s.to_dict()
    assert d == {"0": "ball", "2": "player"}          # JSON-ready string ids
    back = ClassSchema.from_dict(d)
    assert back.names == s.names
    assert back.player_class_ids == s.player_class_ids


def test_unknown_id_and_name_are_other():
    s = ClassSchema.from_names({5: "scoreboard"})
    assert s.role_of(5) == OTHER
    assert s.role_of(999) == OTHER                     # never-seen id
    assert s.person_class_ids == set()


def test_default_football_schema_matches_canonical_order():
    s = default_football_schema()
    assert FOOTBALL_CLASSES == ["ball", "goalkeeper", "player", "referee"]
    assert s.role_of(0) == BALL
    assert s.role_of(1) == GOALKEEPER
    assert s.role_of(2) == PLAYER
    assert s.role_of(3) == REFEREE
