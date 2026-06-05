"""Idempotent seed of ONE clearly-labelled demo match with realistic events, so
the spatial-analytics page (xG / shot map / pass networks) has something to show
on a fresh deployment without a paid Wyscout export.

The ENGINE, API and UI are real; only this event *data* is synthetic and the
match is labelled as such. Re-runnable: it finds its own demo match by
``external_ref`` and replaces that match's events.

Run from the backend dir:  python seed_analytics.py
"""
from __future__ import annotations

import random
from datetime import date

from app.core.database import SessionLocal
from app.models.club import Club
from app.models.player import Player
from app.models.match import Match
from app.models.match_event import MatchEvent

OWN, OPP = "U. Católica", "Colo-Colo"
DEMO_REF = "DEMO-ANALYTICS-UC-CC"


def _build_events(own_player_ids: list[int]) -> list[dict]:
    random.seed(1907)  # reproducible
    events: list[dict] = []
    clock = {"1H": 0.0, "2H": 0.0}

    def add(team, etype, x, y, *, ex=None, ey=None, outcome=None, sub=None, pid=None, period="1H"):
        clock[period] += random.uniform(2, 9)
        sec = clock[period]
        events.append(dict(
            team_name=team, is_own_team=(team == OWN),
            event_type=etype, event_subtype=sub, outcome=outcome,
            x=round(x, 1), y=round(y, 1),
            end_x=(round(ex, 1) if ex is not None else None),
            end_y=(round(ey, 1) if ey is not None else None),
            player_id=pid, period=period, minute=int(sec // 60), second=int(sec % 60),
            event_sec=round(sec, 1),
        ))

    def possession(team, period):
        is_own = team == OWN
        x, y = random.uniform(20, 45), random.uniform(20, 80)
        for _ in range(random.randint(2, 8)):
            pid = random.choice(own_player_ids) if (is_own and own_player_ids) else None
            nx = min(98, x + random.uniform(3, 22))
            ny = min(95, max(5, y + random.uniform(-18, 18)))
            ok = random.random() < 0.82
            add(team, "pass", x, y, ex=nx, ey=ny,
                outcome="successful" if ok else "unsuccessful", pid=pid, period=period)
            if not ok:
                return
            x, y = nx, ny
            if x > 78 and random.random() < 0.30:
                break
        if x > 70 and random.random() < 0.55:
            pid = random.choice(own_player_ids) if (is_own and own_player_ids) else None
            sx = random.uniform(78, 97)
            sy = min(92, max(8, random.gauss(50, 12)))
            r = random.random()
            outcome = "goal" if r < 0.11 else ("on_target" if r < 0.42 else "off_target")
            add(team, "shot", sx, sy, outcome=outcome, pid=pid, period=period)
        else:
            add(team, "duel", x, y, pid=(random.choice(own_player_ids) if (is_own and own_player_ids) else None), period=period)

    for period in ("1H", "2H"):
        for _ in range(70):
            possession(OWN if random.random() < 0.54 else OPP, period)

    add(OWN, "shot", 88.0, 50.0, outcome="goal", sub="penalty",
        pid=(random.choice(own_player_ids) if own_player_ids else None), period="2H")
    add(OPP, "shot", 88.0, 50.0, outcome="on_target", sub="penalty", period="1H")
    return events


def run() -> None:
    db = SessionLocal()
    try:
        club = db.query(Club).filter(Club.slug == "deporte-fc").first()
        if club is None:
            club = db.query(Club).first()
        if club is None:
            print("⚠️  No hay club; corré seed.py primero.")
            return
        club_id = club.id
        own_player_ids = [p.id for p in db.query(Player).filter(Player.club_id == club_id).limit(14).all()]

        match = db.query(Match).filter(Match.club_id == club_id, Match.external_ref == DEMO_REF).first()
        if match is None:
            match = Match(
                date=date(2026, 5, 31), opponent=OPP, is_home=True,
                competition="Liga de Primera 2026 — Fecha 13",
                club_id=club_id, external_ref=DEMO_REF, source="demo",
                notes="PARTIDO DE MUESTRA — eventos sintéticos para demostrar la "
                      "analítica espacial (xG, mapa de remates, redes de pase).",
            )
            db.add(match)
            db.flush()

        # Idempotent: replace this demo match's events.
        db.query(MatchEvent).filter(MatchEvent.match_id == match.id).delete()
        events = _build_events(own_player_ids)
        for e in events:
            db.add(MatchEvent(match_id=match.id, club_id=club_id, **e))
        db.commit()
        print(f"[seed_analytics] demo match_id={match.id} (UC vs CC) con {len(events)} eventos.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
