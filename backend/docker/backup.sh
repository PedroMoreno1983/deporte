#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Periodic *verified* PostgreSQL backup loop (compliance #13).
# Runs in its own container off postgres:alpine.
#
# Every BACKUP_INTERVAL_SECONDS it:
#   1. pg_dumps the database and gzips it into /backups with a UTC timestamp,
#      atomically (a half-written dump never gets a final name);
#   2. VERIFIES the dump by restoring it into a throwaway scratch database and
#      asserting the restore applies cleanly and yields tables — a backup you
#      can't restore is not a backup;
#   3. writes a <file>.sha256 checksum sidecar and appends a manifest.jsonl line
#      (auditable history of every run + its verification result);
#   4. prunes dumps older than BACKUP_RETENTION_DAYS.
#
# A failed dump OR a failed verification is logged loudly but never crashes the
# loop — one transient hiccup must not stop all future backups. A dump that
# fails verification is renamed *.UNVERIFIED.sql.gz so nobody mistakes it for a
# restorable backup.
#
# Restore (manual):
#   gunzip -c /backups/deporte-YYYYmmddTHHMMSSZ.sql.gz \
#     | psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE"
#
# Required env (provided by compose): PGHOST PGUSER PGPASSWORD PGDATABASE
# Optional: BACKUP_INTERVAL_SECONDS (default 86400) BACKUP_RETENTION_DAYS (7)
# ─────────────────────────────────────────────────────────────────────────────
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION="${BACKUP_RETENTION_DAYS:-7}"
MANIFEST="${BACKUP_DIR}/manifest.jsonl"

mkdir -p "$BACKUP_DIR"

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [backup] $*"; }

# Restore $1 (a .sql.gz) into a throwaway scratch DB to prove it is recoverable.
# Sets VERIFY_TABLES to the number of public tables found. Returns 0 if the dump
# restores cleanly and yields at least one table, else 1. Always drops scratch.
verify_dump() {
  dump="$1"
  scratch="verify_$$_$(date -u +%H%M%S)"
  VERIFY_TABLES=0

  if ! createdb -h "$PGHOST" -U "$PGUSER" "$scratch" >/dev/null 2>&1; then
    log "verify: could not create scratch db ${scratch}"
    return 1
  fi

  ok=1
  # ON_ERROR_STOP=1 → psql exits non-zero on the first SQL error, so a truncated
  # or corrupt dump is caught instead of silently half-applying.
  if ! gunzip -c "$dump" | psql -h "$PGHOST" -U "$PGUSER" -d "$scratch" \
       -v ON_ERROR_STOP=1 -q >/dev/null 2>&1; then
    log "verify: restore did not apply cleanly"
    ok=0
  fi

  if [ "$ok" -eq 1 ]; then
    VERIFY_TABLES="$(psql -h "$PGHOST" -U "$PGUSER" -d "$scratch" -tAc \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" \
      2>/dev/null | tr -d '[:space:]')"
    [ -n "$VERIFY_TABLES" ] || VERIFY_TABLES=0
    if ! [ "$VERIFY_TABLES" -gt 0 ] 2>/dev/null; then
      log "verify: restored db has no tables"
      ok=0
    fi
  fi

  dropdb -h "$PGHOST" -U "$PGUSER" --if-exists "$scratch" >/dev/null 2>&1 || true
  [ "$ok" -eq 1 ]
}

prune() {
  DELETED="$(find "$BACKUP_DIR" -name "${PGDATABASE}-*.sql.gz" -type f -mtime "+${RETENTION}" -print -delete | wc -l | tr -d ' ')"
  [ "$DELETED" != "0" ] && log "pruned ${DELETED} backup(s) older than ${RETENTION}d"
  # Drop orphaned checksum sidecars whose dump was pruned.
  find "$BACKUP_DIR" -name "${PGDATABASE}-*.sql.gz.sha256" -type f 2>/dev/null | while read -r sc; do
    [ -f "${sc%.sha256}" ] || rm -f "$sc"
  done
  return 0
}

log "verified-backup loop started — interval=${INTERVAL}s retention=${RETENTION}d target=${PGHOST}/${PGDATABASE}"

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
    log "dump ok ($(du -h "$OUT" | cut -f1))"

    if verify_dump "$OUT"; then
      VERIFIED=true
      log "verify ok — restored ${VERIFY_TABLES} table(s) into a scratch db"
    else
      VERIFIED=false
      UNV="${OUT%.sql.gz}.UNVERIFIED.sql.gz"
      mv "$OUT" "$UNV"
      OUT="$UNV"
      log "ERROR: verification FAILED — flagged as ${OUT}"
    fi

    SIZE="$(stat -c%s "$OUT" 2>/dev/null || wc -c < "$OUT" | tr -d ' ')"
    SHA="$(sha256sum "$OUT" | cut -d' ' -f1)"
    printf '%s  %s\n' "$SHA" "$(basename "$OUT")" > "${OUT}.sha256"
    printf '{"created_at":"%s","artifact":"%s","size_bytes":%s,"sha256":"%s","verified":%s,"tables":%s}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$OUT")" "$SIZE" "$SHA" "$VERIFIED" "${VERIFY_TABLES:-0}" \
      >> "$MANIFEST"
  else
    log "ERROR: pg_dump failed; leaving previous backups intact"
    rm -f "$TMP"
  fi

  prune

  log "sleeping ${INTERVAL}s"
  sleep "$INTERVAL"
done
