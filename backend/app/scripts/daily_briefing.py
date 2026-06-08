"""Generate today's proactive squad briefing for every club.

Run on a daily schedule. On Railway, add a **Cron** service with command:
    python -m app.scripts.daily_briefing
(or it runs via Celery beat where a worker is deployed — see worker/tasks.py).

Idempotent: re-running the same day updates that day's briefing.
"""
from __future__ import annotations

import logging


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
    log = logging.getLogger("daily_briefing")

    from app.core.database import SessionLocal
    from app.core.config import settings
    from app.agent.briefing import run_for_all_clubs

    provider = None
    if settings.GROQ_API_KEY:
        try:
            from app.agent.provider import GroqProvider
            provider = GroqProvider(api_key=settings.GROQ_API_KEY)
        except Exception as exc:  # noqa: BLE001 — fall back to templated narrative
            log.warning("Sin LLM (%s); uso narrativa por plantilla.", exc)

    db = SessionLocal()
    try:
        results = run_for_all_clubs(db, provider=provider, notify=True)
        for r in results:
            log.info("briefing %s", r)
        log.info("Listo: %d club(es).", len(results))
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
