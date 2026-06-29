from __future__ import annotations

from pathlib import Path

from app.models.user import UserRole
from app.models.video_analysis import CVStatus, VideoAnalysis

API = "/api/v1"


def _headers(client, make_user, **user_kw):
    make_user(role=UserRole.COACH, password="Secret123!", **user_kw)
    login = client.post(f"{API}/auth/login", json={"email": user_kw.get("email", "coach@club.cl"), "password": "Secret123!"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, login.json()["access_token"]


def test_cv_diagnostics_reports_model_and_runtime(client, make_user, monkeypatch, tmp_path):
    monkeypatch.setenv("DEPORTE_CV_ROOT", str(tmp_path / "cv"))
    monkeypatch.delenv("DEPORTE_YOLO_CKPT", raising=False)
    headers, _ = _headers(client, make_user, club_id=1)

    r = client.get(f"{API}/cv/diagnostics", headers=headers)

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["model"]["source"] in {"base", "finetuned", "env", "explicit"}
    assert "is_finetuned" in body["model"]
    assert body["runtime"]["max_upload_mb"] == 500
    assert ".mp4" in body["runtime"]["allowed_extensions"]
    assert body["infrastructure"]["dispatch_mode"] in {"celery-worker", "api-background-fallback"}
    assert isinstance(body["warnings"], list)


def test_cv_output_video_serves_generated_mp4(client, make_user, db_session, tmp_path):
    headers, token = _headers(client, make_user, club_id=7)
    del headers

    out_dir = tmp_path / "analysis"
    out_dir.mkdir()
    output = out_dir / "output.mp4"
    output.write_bytes(b"fake-mp4")

    db = db_session()
    try:
        row = VideoAnalysis(
          name="clip",
          video_path=str(tmp_path / "input.mp4"),
          output_dir=str(out_dir),
          club_id=7,
          status=CVStatus.DONE,
          progress=1.0,
          results={"output_video": "output.mp4"},
      )
        db.add(row)
        db.commit()
        analysis_id = row.id
    finally:
        db.close()

    r = client.get(f"{API}/cv/{analysis_id}/output.mp4", params={"token": token})

    assert r.status_code == 200, r.text
    assert r.content == b"fake-mp4"
    assert r.headers["content-type"].startswith("video/mp4")