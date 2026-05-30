#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Periodic PostgreSQL backup loop (runs in its own container off postgres:alpine).
#
# Every BACKUP_INTERVAL_SECONDS it pg_dumps the database, gzips it into
# /backups with a UTC timestamp, then prunes dumps older than
# BACKUP_RETENTION_DAYS. A failed dump is logged but never crashes the loop —
# we don't want one transient hiccup to stop all future backups.
#
# Restore (manual):
#   gunzip -c /backups/deporte_db-YYYYmmddTHHMMSSZ.sql.gz \
#     | psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE"
#
# Required env (provided by compose): PGHOST PGUSER PGPASSWORD PGDATABASE
# Optional: BACKUP_INTERVAL_SECONDS (default 86400) BACKUP_RETENTION_DAYS (7)
# ─────────────────────────────────────────────────────────────────────────────
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [backup] $*"; }

log "backup loop started — interval=${INTERVAL}s retention=${RETENTION}d target=${PGHOST}/${PGDATABASE}"

# Wait for Postgres to accept connections before the first dump.
until pg_isready -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  log "waiting for postgres at ${PGHOST}…"
  sleep 3
done

while true; do
  STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
  OUT="${BACKUP_DIR}/${PGDATABASE}-${STAMP}.sql.gz"
  TMP="${OUT}.partial"

  log "dumping → ${OUT}"
  if pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" --no-owner --no-privileges \
       | gzip -c > "$TMP"; then
    mv "$TMP" "$OUT"   # atomic: a half-written dump never gets a final name
    log "ok ($(du -h "$OUT" | cut -f1))"
  else
    log "ERROR: pg_dump failed; leaving previous backups intact"
    rm -f "$TMP"
  fi

  # Prune old dumps (only fully-named .sql.gz, never *.partial).
  DELETED="$(find "$BACKUP_DIR" -name "${PGDATABASE}-*.sql.gz" -type f -mtime "+${RETENTION}" -print -delete | wc -l | tr -d ' ')"
  [ "$DELETED" != "0" ] && log "pruned ${DELETED} backup(s) older than ${RETENTION}d"

  log "sleeping ${INTERVAL}s"
  sleep "$INTERVAL"
done
