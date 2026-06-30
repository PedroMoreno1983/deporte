from __future__ import annotations

from datetime import date

from app.models.category import Category
from app.models.club import Club
from app.models.match import Match
from app.models.player import Player, PlayerPosition
from app.models.user import UserRole
from app.models.video_analysis import CVStatus, VideoAnalysis

API = "/api/v1"

def _headers(client, make_user, *, club_id: int = 1):
    make_user(
        email="analyst@club.cl",
        password="Secret123!",
        role=UserRole.ANALYST,
        club_id=club_id,
    )
    login = client.post(
        f"{API}/auth/login",
        json={"email": "analyst@club.cl", "password": "Secret123!"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}

def _seed_context(db_session):
    db = db_session()
    try:
        club = Club(id=9, name="Deporte FC", slug="deporte-fc")
        category = Category(id=91, name="Adulto", code="AD", club_id=9)
        player = Player(
            id=901,
            first_name="Juan",
            last_name="Perez",
            date_of_birth=date(1995, 1, 1),
            jersey_number=8,
            position=PlayerPosition.CENTRAL_MID,
            category_id=91,
            club_id=9,
        )
        match = Match(id=902, date=date(2026, 6, 29), opponent="Rival", club_id=9)
        db.add_all([club, category, player, match])
        db.commit()
    finally:
        db.close()

def test_create_tag_creates_library_clip(client, make_user, db_session):
    _seed_context(db_session)
    headers = _headers(client, make_user, club_id=9)

    r = client.post(
        f"{API}/video-lab/tags",
        headers=headers,
        json={
            "match_id": 902,
            "player_id": 901,
            "action_type": "Pase",
            "event_s": 75,
            "clip_margin_s": 5,
            "team_label": "Propio",
            "pitch_x": 45,
            "pitch_y": 60,
        },
    )

    assert r.status_code == 201, r.text
    body = r.json()
    assert body["clip"]["player_name"] == "Juan Perez"
    assert body["clip"]["start_s"] == 70
    assert body["clip"]["end_s"] == 80

    clips = client.get(f"{API}/video-lab/clips", headers=headers).json()
    assert len(clips) == 1
    assert clips[0]["action_type"] == "Pase"
    assert clips[0]["player_jersey"] == 8

    summary = client.get(f"{API}/video-lab/summary", headers=headers).json()
    assert summary["clips"] == 1
    assert summary["players_tagged"] == 1

def test_playlist_accepts_clip_once(client, make_user, db_session):
    _seed_context(db_session)
    headers = _headers(client, make_user, club_id=9)
    tag = client.post(
        f"{API}/video-lab/tags",
        headers=headers,
        json={"match_id": 902, "action_type": "Tiro", "event_s": 120},
    ).json()
    clip_id = tag["clip"]["id"]

    playlist = client.post(
        f"{API}/video-lab/playlists",
        headers=headers,
        json={"title": "Highlights rival", "purpose": "post-partido"},
    )
    assert playlist.status_code == 201, playlist.text
    playlist_id = playlist.json()["id"]

    for _ in range(2):
        added = client.post(
            f"{API}/video-lab/playlists/{playlist_id}/clips",
            headers=headers,
            json={"clip_id": clip_id},
        )
        assert added.status_code == 200, added.text
        assert added.json()["clips_count"] == 1

def test_shared_playlist_token_flow(client, make_user, db_session):
    _seed_context(db_session)
    headers = _headers(client, make_user, club_id=9)
    tag = client.post(
        f"{API}/video-lab/tags",
        headers=headers,
        json={"match_id": 902, "player_id": 901, "action_type": "Gol", "event_s": 210},
    ).json()
    clip_id = tag["clip"]["id"]

    playlist = client.post(
        f"{API}/video-lab/playlists",
        headers=headers,
        json={"title": "Para Juan", "purpose": "jugador"},
    ).json()
    playlist_id = playlist["id"]
    client.post(
        f"{API}/video-lab/playlists/{playlist_id}/clips",
        headers=headers,
        json={"clip_id": clip_id},
    )

    enabled = client.patch(
        f"{API}/video-lab/playlists/{playlist_id}",
        headers=headers,
        json={"is_shared": True},
    )
    assert enabled.status_code == 200, enabled.text
    token = enabled.json()["share_token"]
    assert token

    shared = client.get(f"{API}/video-lab/share/{token}")
    assert shared.status_code == 200, shared.text
    body = shared.json()
    assert body["title"] == "Para Juan"
    assert len(body["clips"]) == 1
    assert body["clips"][0]["player_name"] == "Juan Perez"

    disabled = client.patch(
        f"{API}/video-lab/playlists/{playlist_id}",
        headers=headers,
        json={"is_shared": False},
    )
    assert disabled.status_code == 200, disabled.text
    assert disabled.json()["share_token"] is None
    assert client.get(f"{API}/video-lab/share/{token}").status_code == 404

def test_import_cv_analysis_creates_named_clips(client, make_user, db_session):
    _seed_context(db_session)
    db = db_session()
    try:
        analysis = VideoAnalysis(
            id=903,
            name="Clip procesado",
            video_path="fake.mp4",
            output_dir=".",
            duration_s=90,
            fps=25,
            frame_count=2250,
            status=CVStatus.DONE,
            progress=1.0,
            club_id=9,
            match_id=902,
            results={
                "duration_s": 90,
                "tracks": [
                    {
                        "track_id": 1,
                        "jersey": 8,
                        "team": "A",
                        "distance_m": 120,
                        "intensity": {"events": [{"kind": "sprint", "start_t": 12, "end_t": 14, "peak_speed_kmh": 26}]},
                    },
                    {
                        "track_id": 2,
                        "jersey": 30,
                        "team": "B",
                        "distance_m": 40,
                        "top_speed_kmh": 12,
                        "intensity": {"events": []},
                    },
                ],
                "identities": [
                    {"identity": 1, "track_ids": [1], "team": "A", "jersey": 8, "distance_m": 120, "top_speed_kmh": 26},
                    {"identity": 2, "track_ids": [2], "team": "B", "jersey": 30, "distance_m": 40, "top_speed_kmh": 12},
                ],
            },
        )
        db.add(analysis)
        db.commit()
    finally:
        db.close()

    headers = _headers(client, make_user, club_id=9)
    imported = client.post(f"{API}/video-lab/import-cv/903", headers=headers)
    assert imported.status_code == 200, imported.text
    body = imported.json()
    assert body["created_clips"] == 2
    assert body["matched_players"] == 1

    clips = client.get(f"{API}/video-lab/clips", headers=headers).json()
    assert len(clips) == 2
    assert any(c["player_name"] == "Juan Perez" and c["action_type"] == "Sprint" for c in clips)
    assert any(c["player_name"] is None and "Dorsal #30" in c["title"] for c in clips)

    again = client.post(f"{API}/video-lab/import-cv/903", headers=headers)
    assert again.status_code == 200, again.text
    assert again.json()["created_clips"] == 0
    assert again.json()["skipped_existing"] == 2
