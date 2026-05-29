"""Shared types + helpers used by all importers."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session


@dataclass
class ImportError_:
    row: Optional[int]
    msg: str

    def to_dict(self) -> Dict[str, Any]:
        return {"row": self.row, "msg": self.msg}


@dataclass
class ImportResult:
    rows_total:    int                = 0
    rows_imported: int                = 0
    rows_skipped:  int                = 0
    errors:        List[Dict[str, Any]] = field(default_factory=list)
    # Importer-specific summary the UI can render: e.g. {"matches": 3, "players": 22}
    summary:       Dict[str, Any]     = field(default_factory=dict)
    # Parsed-but-not-yet-applied records (importers may use this internally)
    records:       List[Dict[str, Any]] = field(default_factory=list)

    def add_error(self, row: Optional[int], msg: str) -> None:
        self.errors.append({"row": row, "msg": msg})


class BaseImporter:
    """Two-phase importer: `parse` is pure (no DB), `apply` writes to DB."""

    # Human label shown in the UI; subclasses override.
    label: str = "Generic importer"

    # Allowed file extensions. Use lowercase, with the dot.
    accepted_extensions: tuple = (".csv",)

    def __init__(self, options: Optional[Dict[str, Any]] = None):
        # Upload-time context the file itself can't carry: which player a
        # per-device Garmin file belongs to, or the date/opponent for a match
        # export whose header lacks them. Set by the endpoint before parse().
        self.options: Dict[str, Any] = dict(options or {})

    def parse(self, path: Path) -> ImportResult:  # noqa: D401
        raise NotImplementedError

    def apply(self, result: ImportResult, db: Session, *, club_id: int) -> None:  # noqa: D401
        raise NotImplementedError

    # ── Helpers shared by subclasses ─────────────────────────────────

    @staticmethod
    def _to_float(v: Any) -> Optional[float]:
        if v is None or v == "":
            return None
        try:
            return float(str(v).replace(",", ".").strip())
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _to_int(v: Any) -> Optional[int]:
        f = BaseImporter._to_float(v)
        return int(f) if f is not None else None

    @staticmethod
    def _norm_key(s: str) -> str:
        """lower, strip, replace non-alnum with _ — robust CSV header matching."""
        import re
        out = re.sub(r"[^a-z0-9]+", "_", s.strip().lower())
        return out.strip("_")
