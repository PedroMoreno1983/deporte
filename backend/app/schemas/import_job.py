from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict

from ..models.import_job import ImportKind, ImportProvider, ImportStatus


class ProviderPair(BaseModel):
    """One selectable (provider, kind) combination for the upload UI."""
    provider: str
    kind:     str
    label:    str


class ImportJobSummary(BaseModel):
    id:              int
    provider:        ImportProvider
    kind:            ImportKind
    source_filename: str
    status:          ImportStatus
    rows_total:      int
    rows_imported:   int
    rows_skipped:    int
    created_at:      datetime
    finished_at:     Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ImportJobOut(ImportJobSummary):
    source_size: Optional[int] = None
    sha256:      Optional[str] = None
    errors:      Optional[List[Dict[str, Any]]] = None
    summary:     Optional[Dict[str, Any]] = None
    notes:       Optional[str] = None
    started_at:  Optional[datetime] = None
