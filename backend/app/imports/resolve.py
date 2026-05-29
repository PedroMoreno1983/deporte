"""
Player identity resolution for imports.

External feeds name players differently than we do ("J. Pérez", "PEREZ Juan",
"#10", "Juan Pérez González"). We resolve to a `Player` row within the club by,
in order: jersey number → exact normalised full name → last name (+ first
initial) → unique last-name match. Unresolved rows are reported as skipped so
the user can see exactly which names need a manual map — we never guess across
two equally-likely players.

A `PlayerResolver` preloads the club roster once so an import does O(1) lookups
instead of one query per row.
"""
from __future__ import annotations

import unicodedata
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from ..models.player import Player


def _norm_name(s: str) -> str:
    """Lowercase, strip accents/punctuation, collapse whitespace."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    out = []
    for ch in s:
        out.append(ch if ch.isalnum() or ch.isspace() else " ")
    return " ".join("".join(out).split())


class PlayerResolver:
    def __init__(self, db: Session, club_id: int):
        self.club_id = club_id
        players: List[Player] = (
            db.query(Player).filter(Player.club_id == club_id).all()
        )
        self._by_jersey: Dict[int, List[Player]] = {}
        self._by_full: Dict[str, List[Player]] = {}
        self._by_last: Dict[str, List[Player]] = {}
        self._by_last_initial: Dict[str, List[Player]] = {}

        for p in players:
            if p.jersey_number is not None:
                self._by_jersey.setdefault(p.jersey_number, []).append(p)
            full = _norm_name(f"{p.first_name} {p.last_name}")
            full_rev = _norm_name(f"{p.last_name} {p.first_name}")
            for key in {full, full_rev}:
                self._by_full.setdefault(key, []).append(p)
            last = _norm_name(p.last_name)
            self._by_last.setdefault(last, []).append(p)
            fi = _norm_name(p.first_name)[:1]
            if last and fi:
                self._by_last_initial.setdefault(f"{last} {fi}", []).append(p)

    @staticmethod
    def _unique(matches: Optional[List[Player]]) -> Optional[Player]:
        return matches[0] if matches and len(matches) == 1 else None

    def resolve(
        self,
        *,
        jersey: Optional[int] = None,
        name: Optional[str] = None,
    ) -> Optional[Player]:
        if jersey is not None:
            hit = self._unique(self._by_jersey.get(jersey))
            if hit:
                return hit

        if name:
            n = _norm_name(name)
            if not n:
                return None

            hit = self._unique(self._by_full.get(n))
            if hit:
                return hit

            # "lastname f" form (e.g. "perez j")
            parts = n.split()
            if len(parts) >= 2:
                # try treating last token as first-initial, rest as last name
                candidate = f"{' '.join(parts[:-1])} {parts[-1][:1]}"
                hit = self._unique(self._by_last_initial.get(candidate))
                if hit:
                    return hit
                # try "first last" → last + first-initial
                candidate2 = f"{parts[-1]} {parts[0][:1]}"
                hit = self._unique(self._by_last_initial.get(candidate2))
                if hit:
                    return hit

            # single distinctive last name
            for token in parts:
                hit = self._unique(self._by_last.get(token))
                if hit:
                    return hit

        return None
