"""Semantic class schema for the detector — the bridge between *whatever*
classes a YOLO checkpoint happens to expose and the four roles the pipeline
reasons about: player, goalkeeper, referee, ball.

Why this exists
---------------
The stock ``yolov8n.pt`` is trained on COCO, where the only useful classes are
``person`` (id 0) and ``sports ball`` (id 32). A model fine-tuned on a football
dataset (SoccerNet, the Roboflow football-players set, …) instead exposes
purpose-built classes — typically ``player`` / ``goalkeeper`` / ``referee`` /
``ball`` at ids 0-3, but the order is dataset-dependent and must NOT be
hard-coded.

So the pipeline must never key off raw integer class ids. It asks this schema
"which ids are people I should track?" / "which ids are the ball?" and the
schema answers by inspecting the *names* the checkpoint ships with. That keeps
one pipeline working across the stock model and every fine-tune.

Pure-Python on purpose: no numpy / torch / ultralytics import here, so it loads
on any host and is unit-testable without the heavy CV stack installed.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

# ── canonical roles ──────────────────────────────────────────────────────────
PLAYER = "player"
GOALKEEPER = "goalkeeper"
REFEREE = "referee"
BALL = "ball"
OTHER = "other"

ROLES = (PLAYER, GOALKEEPER, REFEREE, BALL, OTHER)

# Keyword → role. Matched as case-insensitive substrings against each class
# name. Spanish terms included because the product ships to Chilean clubs and a
# locally-labelled dataset may use them. Order of *evaluation* (below) matters:
# the person roles are tested before BALL so that a class literally named
# "football player" resolves to PLAYER, not BALL (it contains the substring
# "ball").
_GOALKEEPER_KW = ("goalkeeper", "keeper", "portero", "arquero", "guardameta", "golero")
_REFEREE_KW = ("referee", "umpire", "linesman", "arbitro", "árbitro", "juez")
_PLAYER_KW = ("player", "person", "jugador", "outfield", "footballer")
_BALL_KW = ("ball", "balon", "balón", "pelota", "esferico", "esférico")


def _classify(name: str) -> str:
    """Map a single raw class name to one canonical role."""
    n = name.strip().lower()
    if not n:
        return OTHER
    # Goalkeeper and referee first: they're more specific than the generic
    # "player"/"person", and a name like "goalkeeper" must not fall through to
    # a looser match.
    if any(kw in n for kw in _GOALKEEPER_KW):
        return GOALKEEPER
    if n == "ref" or any(kw in n for kw in _REFEREE_KW):
        return REFEREE
    if any(kw in n for kw in _PLAYER_KW):
        return PLAYER
    # Ball last so "football player" / "handball player" never read as the ball.
    if any(kw in n for kw in _BALL_KW):
        return BALL
    return OTHER


@dataclass
class ClassSchema:
    """Resolved id→name mapping plus the derived id→role view.

    Construct from a checkpoint's ``model.names`` via :meth:`from_names`, or from
    a persisted sidecar via :meth:`from_dict`. The ``*_class_ids`` accessors are
    what the pipeline actually consumes.
    """

    names: Dict[int, str]
    roles: Dict[int, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        # Normalise keys to int (sidecar JSON loads them as str) and (re)derive
        # roles so a hand-built schema is always self-consistent.
        self.names = {int(k): str(v) for k, v in self.names.items()}
        self.roles = {cid: _classify(nm) for cid, nm in self.names.items()}

    # ── role → id sets ────────────────────────────────────────────────────────
    def _ids_for(self, role: str) -> Set[int]:
        return {cid for cid, r in self.roles.items() if r == role}

    @property
    def player_class_ids(self) -> Set[int]:
        return self._ids_for(PLAYER)

    @property
    def goalkeeper_class_ids(self) -> Set[int]:
        return self._ids_for(GOALKEEPER)

    @property
    def referee_class_ids(self) -> Set[int]:
        return self._ids_for(REFEREE)

    @property
    def ball_class_ids(self) -> Set[int]:
        return self._ids_for(BALL)

    @property
    def person_class_ids(self) -> Set[int]:
        """Every human on the pitch worth tracking: players + keepers + refs.

        For a COCO model this is just ``{0}`` (person), preserving the original
        pipeline behaviour. For a fine-tune it widens to the dedicated human
        classes. Team assignment can still drop referees downstream; here we
        keep them so they're tracked rather than silently dropped.
        """
        return self.player_class_ids | self.goalkeeper_class_ids | self.referee_class_ids

    def role_of(self, class_id: int) -> str:
        return self.roles.get(int(class_id), OTHER)

    @property
    def is_finetuned_football(self) -> bool:
        """Heuristic: does this look like a football-specific model (has a
        dedicated player/goalkeeper/referee class) rather than generic COCO?"""
        return bool(self.player_class_ids and "person" not in
                    {n.lower() for n in self.names.values()})

    # ── (de)serialisation for the checkpoint sidecar ───────────────────────────
    def to_dict(self) -> Dict[str, str]:
        """``{id: name}`` with string ids, ready for JSON."""
        return {str(cid): nm for cid, nm in sorted(self.names.items())}

    @classmethod
    def from_dict(cls, data: Dict) -> "ClassSchema":
        return cls(names={int(k): str(v) for k, v in (data or {}).items()})

    @classmethod
    def from_names(cls, names) -> "ClassSchema":
        """Build from a checkpoint's ``names`` (dict ``{id: name}`` or a list)."""
        if isinstance(names, dict):
            mapping = {int(k): str(v) for k, v in names.items()}
        else:  # ultralytics sometimes exposes names as an ordered list
            mapping = {i: str(v) for i, v in enumerate(names or [])}
        return cls(names=mapping)

    @classmethod
    def coco_default(cls) -> "ClassSchema":
        """The minimal COCO view the stock ``yolov8n.pt`` needs: person + ball.

        Used as a safe fallback when a checkpoint exposes no names at all.
        """
        return cls(names={0: "person", 32: "sports ball"})


# Convenience for callers that only need the football class list (e.g. writing
# a dataset's data.yaml). Order defines the integer ids in a fresh fine-tune.
FOOTBALL_CLASSES: List[str] = [BALL, GOALKEEPER, PLAYER, REFEREE]


def default_football_schema() -> ClassSchema:
    """The class schema a from-scratch football fine-tune is expected to use."""
    return ClassSchema.from_names(FOOTBALL_CLASSES)
