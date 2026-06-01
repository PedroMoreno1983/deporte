"""One-shot, idempotent backfill: encrypt pre-existing plaintext sensitive data.

After field-level encryption is deployed (compliance #12), legacy rows still
hold *plaintext* in the now-encrypted columns. The app reads them fine — the
decrypter passes untagged values through — and re-encrypts them on the next
write. This script does that proactively so nothing sensitive lingers in the
clear, walking each protected column and encrypting any value that isn't already
tagged ciphertext.

Safe to run repeatedly: already-encrypted values are skipped, so a second run is
a no-op. Run it once after rolling out the encrypted models:

    python -m app.scripts.encrypt_phi
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from ..core.crypto import encrypt, is_encrypted
from ..core.database import engine as default_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("encrypt_phi")

# Protected columns — must mirror the ``EncryptedString`` columns on the models.
PROTECTED_COLUMNS: Dict[str, List[str]] = {
    "injuries":            ["description", "treatment", "recovery_milestones", "notes"],
    "kinesiology_records": ["notes"],
    "wellness_entries":    ["notes"],
    "prediction_scores":   ["notes"],
    "users":               ["totp_secret"],   # 2FA secret (compliance #11)
}


def encrypt_existing(bind: Optional[Engine] = None) -> int:
    """Encrypt every plaintext value in the protected columns. Returns the count
    of rows updated. Idempotent — already-encrypted values are left untouched."""
    eng = bind or default_engine
    inspector = inspect(eng)
    existing_tables = set(inspector.get_table_names())
    # Reflect all column metadata BEFORE opening the write transaction. Under a
    # StaticPool (single shared connection — used by the in-memory test engine)
    # the inspector's reflection queries execute on that same connection and
    # would reset the pending transaction, silently discarding our UPDATEs.
    cols_by_table = {
        t: {c["name"] for c in inspector.get_columns(t)}
        for t in PROTECTED_COLUMNS
        if t in existing_tables
    }
    updated = 0

    with eng.begin() as conn:
        for table, columns in PROTECTED_COLUMNS.items():
            table_cols = cols_by_table.get(table)
            if not table_cols:
                continue
            for col in columns:
                if col not in table_cols:
                    continue
                rows = conn.execute(text(f'SELECT id, "{col}" FROM "{table}"')).fetchall()
                for row_id, value in rows:
                    if value is None or is_encrypted(value):
                        continue
                    conn.execute(
                        text(f'UPDATE "{table}" SET "{col}" = :v WHERE id = :id'),
                        {"v": encrypt(value), "id": row_id},
                    )
                    updated += 1
                if rows:
                    log.info("Checked %s.%s (%d rows)", table, col, len(rows))
    log.info("Encrypted %d previously-plaintext value(s).", updated)
    return updated


def main() -> int:
    encrypt_existing()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
