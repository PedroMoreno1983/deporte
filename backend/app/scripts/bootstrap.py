"""One-shot, idempotent database bootstrap.

Runs as the ``init`` service in the production compose stack *before* the API
and workers start. It does exactly what ``app.main`` does on import — create
any missing tables and reconcile additive nullable columns — but as a discrete,
fail-fast step so a bad schema never half-starts the API.

Safe to run repeatedly: ``create_all`` skips existing tables and
``ensure_schema`` only issues ``ADD COLUMN`` for columns that are genuinely
missing. On a healthy DB this is a no-op that exits 0.
"""
from __future__ import annotations

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("bootstrap")


def main() -> int:
    # Importing the models package registers every table on Base.metadata;
    # without it create_all would see an empty schema.
    import app.models  # noqa: F401
    from app.core.database import Base, engine, ensure_schema

    log.info("Connecting to %s", engine.url.render_as_string(hide_password=True))

    log.info("Creating missing tables…")
    Base.metadata.create_all(bind=engine)

    log.info("Reconciling additive columns…")
    ensure_schema()

    log.info("Schema bootstrap complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
