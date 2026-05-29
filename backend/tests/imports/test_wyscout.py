import json
from datetime import date

from app.imports.wyscout import WyscoutEventsImporter, WyscoutMatchStatsImporter
from app.models.match import Match, MatchStat
from app.models.match_event import MatchEvent

EVENTS = {
    "matchId": 555001,
    "date": "2026-05-22",
    "competition": "Primera División",
    "teamsData": {
        "home": {"team": {"name": "Test FC"}},
        "away": {"team": {"name": "Rival CD"}},
    },
    "events": [
        {"id": 1, "matchId": 555001, "matchPeriod": "1H", "minute": 3, "second": 12,
         "type": {"primary": "pass", "secondary": ["short_pass"]},
         "location": {"x": 50, "y": 50},
         "team": {"name": "Test FC"}, "player": {"name": "Juan Pérez"},
         "pass": {"accurate": True, "endLocation": {"x": 60, "y": 55}}},
        {"id": 2, "matchId": 555001, "matchPeriod": "1H", "minute": 10, "second": 5,
         "type": {"primary": "shot"},
         "location": {"x": 88, "y": 48},
         "team": {"name": "Test FC"}, "player": {"name": "Diego Soto"},
         "shot": {"isGoal": True, "onTarget": True}},
        {"id": 3, "matchId": 555001, "matchPeriod": "2H", "minute": 70, "second": 0,
         "type": {"primary": "duel"},
         "location": {"x": 40, "y": 30},
         "team": {"name": "Rival CD"}, "player": {"name": "Opponent Guy"}},
    ],
}

STATS_CSV = """Player,Team,Date,Competition,Minutes played,Goals,Assists,Shots,Shots on target,Passes,Accurate passes,Interceptions,Yellow cards,Distance,Max speed,Sprints
Juan Pérez,Test FC,2026-05-22,Primera División,90,1,0,4,2,55,48,1,1,10500,31.0,9
Diego Soto,Test FC,2026-05-22,Primera División,78,0,1,2,1,40,35,3,0,9800,29.5,6
"""


def _events_file(tmp_path):
    p = tmp_path / "events.json"
    p.write_text(json.dumps(EVENTS), encoding="utf-8")
    return p


def test_events_normalisation(tmp_path):
    result = WyscoutEventsImporter().parse(_events_file(tmp_path))
    assert result.rows_total == 3
    e1 = result.records[0]
    assert e1["event_type"] == "pass"
    assert e1["event_subtype"] == "short_pass"
    assert e1["outcome"] == "successful"
    assert (e1["x"], e1["y"]) == (50.0, 50.0)
    assert (e1["end_x"], e1["end_y"]) == (60.0, 55.0)
    assert result.records[1]["outcome"] == "goal"
    meta = result.summary["match_meta"]
    assert meta["external_id"] == "555001"
    assert meta["team_names"] == ["Test FC", "Rival CD"]


def test_events_apply_creates_match_and_links_players(tmp_path, db, roster):
    importer = WyscoutEventsImporter()
    result = importer.parse(_events_file(tmp_path))
    importer.apply(result, db, club_id=roster[0].club_id)

    match = db.query(Match).one()
    assert match.date == date(2026, 5, 22)
    assert match.external_ref == "555001"
    assert match.source == "wyscout"

    events = db.query(MatchEvent).all()
    assert len(events) == 3

    juan_pass = db.query(MatchEvent).filter(MatchEvent.event_type == "pass").one()
    assert juan_pass.player_id == roster[0].id   # "Juan Pérez" resolved

    opp = db.query(MatchEvent).filter(MatchEvent.event_type == "duel").one()
    assert opp_player_unresolved(opp)            # opponent stays null, never guessed

    assert result.summary["events"] == 3
    assert result.summary["events_without_player"] == 1

    # Re-import the same match → replace, don't duplicate.
    importer.apply(result, db, club_id=roster[0].club_id)
    assert db.query(MatchEvent).count() == 3
    assert db.query(Match).count() == 1


def opp_player_unresolved(event) -> bool:
    return event.player_id is None and event.team_name == "Rival CD"


def test_match_stats_apply(tmp_path, db, roster):
    p = tmp_path / "stats.csv"
    p.write_text(STATS_CSV, encoding="utf-8")
    importer = WyscoutMatchStatsImporter(options={"opponent": "Rival CD"})
    result = importer.parse(p)
    importer.apply(result, db, club_id=roster[0].club_id)

    assert result.rows_imported == 2
    match = db.query(Match).one()
    assert match.opponent == "Rival CD"

    juan = db.query(MatchStat).filter(MatchStat.player_id == roster[0].id).one()
    assert juan.minutes_played == 90
    assert juan.goals == 1
    assert juan.shots_total == 4
    assert juan.max_speed_kmh == 31.0

    diego = db.query(MatchStat).filter(MatchStat.player_id == roster[1].id).one()
    assert diego.assists == 1

    # Upsert: re-run keeps one stat row per (match, player).
    importer.apply(result, db, club_id=roster[0].club_id)
    assert db.query(MatchStat).count() == 2


def test_events_without_date_fails_cleanly(tmp_path, db, roster):
    data = {"events": [
        {"id": 1, "matchPeriod": "1H", "type": {"primary": "pass"},
         "team": {"name": "Test FC"}, "player": {"name": "Juan Pérez"}},
    ]}
    p = tmp_path / "no_date.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    importer = WyscoutEventsImporter()
    result = importer.parse(p)
    importer.apply(result, db, club_id=roster[0].club_id)

    assert result.rows_imported == 0
    assert result.rows_skipped == 1
    assert db.query(MatchEvent).count() == 0
    assert any("fecha del partido" in e["msg"] for e in result.errors)
