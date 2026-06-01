"""CLI entry point for a verified database backup (compliance #13).

Creates one snapshot, checksums it, restores it into a throwaway location to
prove it is intact, prunes old artifacts per ``BACKUP_RETENTION``, and records
the run in the manifest. Exits non-zero when verification fails so a cron job /
systemd timer can alert:

    python -m app.scripts.backup
"""
from __future__ import annotations

import logging

from ..core.backup import BackupError, run_backup

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("backup.cli")


def main() -> int:
    try:
        result = run_backup()
    except BackupError as exc:
        log.error("Backup failed: %s", exc)
        return 2
    print(result.summary())
    return 0 if result.verified else 1


if __name__ == "__main__":
    raise SystemExit(main())
