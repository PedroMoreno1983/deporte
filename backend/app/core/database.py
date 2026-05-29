import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

log = logging.getLogger("database")

# SQLite needs check_same_thread=False
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema() -> None:
    """Additive-only schema reconciliation.

    `create_all` creates *missing tables* but never alters existing ones, so
    when we add a nullable column to a model it won't appear on a dev DB that
    already exists. This walks every mapped table and issues `ALTER TABLE ADD
    COLUMN` for any column present in the model but missing in the DB.

    Scope on purpose: only NULLABLE columns with no server default — the subset
    that SQLite and Postgres can both add safely in one statement. Anything more
    (drops, type changes, NOT NULL backfills) is a real Alembic migration.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue  # create_all will handle brand-new tables
        db_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in db_cols:
                continue
            if not col.nullable or col.server_default is not None or col.primary_key:
                log.warning(
                    "Column %s.%s missing but needs a migration (not nullable / has default)",
                    table.name, col.name,
                )
                continue
            col_type = col.type.compile(dialect=engine.dialect)
            stmt = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'
            try:
                with engine.begin() as conn:
                    conn.execute(text(stmt))
                log.info("Added column %s.%s", table.name, col.name)
            except Exception as exc:  # noqa: BLE001
                log.error("Failed to add column %s.%s: %s", table.name, col.name, exc)
