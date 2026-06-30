from __future__ import annotations

import os
import secrets
import shutil
import subprocess
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....core.deps import get_current_club_id, get_current_user, require_roles, scoped_query
from ....models.match import Match
from ....models.player import Player
from ....models.user import User, UserRole
from ....models.video_analysis import CVStatus, VideoAnalysis
from ....models.video_lab import (
    VideoClip,
    VideoClipStatus,
    VideoPlaylist,
    VideoPlaylistItem,
    VideoTag,
    VideoTagSource,
    VideoTagStatus,
)
from ....schemas.video_lab import (
    AddClipToPlaylist,
    VideoClipCreate,
    VideoClipOut,
    VideoClipUpdate,
    VideoLabImportResult,
    VideoLabSummary,
    VideoPlaylistCreate,
    VideoPlaylistDetailOut,
    VideoPlaylistOut,
    VideoPlaylistUpdate,
    VideoTagCreate,
    VideoTagOut,
    VideoTagUpdate,
)

router = APIRouter()

def _enum_value(value):
    return getattr(value, "value", value)

def _player_label(player: Player | None) -> tuple[str | None, int | None]:
    if not player:
        return None, None
    return player.full_name, player.jersey_number

def _match_label(match: Match | None) -> str | None:
    if not match:
        return None
    date = match.date.isoformat() if match.date else "sin fecha"
    return f"{date} vs {match.opponent}"

def _clip_out(clip: VideoClip) -> VideoClipOut:
    player_name, jersey = _player_label(clip.player)
    return VideoClipOut(
        id=clip.id,
        club_id=clip.club_id,
        tag_id=clip.tag_id,
        match_id=clip.match_id,
        video_analysis_id=clip.video_analysis_id,
        player_id=clip.player_id,
        title=clip.title,
        action_type=clip.action_type,
        team_label=clip.team_label,
        start_s=clip.start_s,
        end_s=clip.end_s,
        duration_s=clip.duration_s,
        status=_enum_value(clip.status),
        output_path=clip.output_path,
        thumbnail_path=clip.thumbnail_path,
        rating=clip.rating,
        note=clip.note,
        export_error=clip.export_error,
        created_at=clip.created_at,
        player_name=player_name,
        player_jersey=jersey,
        match_label=_match_label(clip.match),
        video_name=clip.video_analysis.name if clip.video_analysis else None,
    )

def _tag_out(tag: VideoTag) -> VideoTagOut:
    clip = tag.clips[0] if tag.clips else None
    return VideoTagOut(
        id=tag.id,
        club_id=tag.club_id,
        match_id=tag.match_id,
        video_analysis_id=tag.video_analysis_id,
        player_id=tag.player_id,
        action_type=tag.action_type,
        phase=tag.phase,
        team_label=tag.team_label,
        event_s=tag.event_s,
        start_s=tag.start_s,
        end_s=tag.end_s,
        pitch_x=tag.pitch_x,
        pitch_y=tag.pitch_y,
        confidence=tag.confidence,
        source=_enum_value(tag.source),
        status=_enum_value(tag.status),
        note=tag.note,
        color=tag.color,
        created_at=tag.created_at,
        clip=_clip_out(clip) if clip else None,
    )

def _playlist_out(row: VideoPlaylist) -> VideoPlaylistOut:
    return VideoPlaylistOut(
        id=row.id,
        club_id=row.club_id,
        title=row.title,
        description=row.description,
        purpose=row.purpose,
        is_shared=row.is_shared,
        share_token=row.share_token,
        created_at=row.created_at,
        clips_count=len(row.items or []),
    )

def _playlist_detail_out(row: VideoPlaylist) -> VideoPlaylistDetailOut:
    clips = [item.clip for item in sorted(row.items or [], key=lambda i: (i.sort_order, i.id)) if item.clip]
    base = _playlist_out(row).model_dump()
    return VideoPlaylistDetailOut(**base, clips=[_clip_out(clip) for clip in clips])

def _get_scoped(model, obj_id: int, db: Session, current_user):
    obj = scoped_query(db.query(model), model, current_user).filter(model.id == obj_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return obj

def _gate_optional_refs(db: Session, current_user, *, match_id=None, video_analysis_id=None, player_id=None):
    match = _get_scoped(Match, match_id, db, current_user) if match_id else None
    video = _get_scoped(VideoAnalysis, video_analysis_id, db, current_user) if video_analysis_id else None
    player = _get_scoped(Player, player_id, db, current_user) if player_id else None
    return match, video, player


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _cv_action_label(kind: str | None) -> str:
    labels = {
        "sprint": "Sprint",
        "acceleration": "Aceleracion",
        "deceleration": "Desaceleracion",
        "direction_change": "Cambio de direccion",
    }
    return labels.get(str(kind or "").lower(), "Evento CV")


def _cv_candidates(analysis: VideoAnalysis) -> list[dict]:
    results = analysis.results or {}
    duration = _safe_float(results.get("duration_s"), analysis.duration_s or 0.0)
    tracks = results.get("tracks") or []
    tracks_by_id = {int(t.get("track_id")): t for t in tracks if _safe_int(t.get("track_id")) is not None}
    identities = results.get("identities") or []
    rows = identities if identities else tracks
    candidates: list[dict] = []

    for row in rows:
        track_ids = row.get("track_ids") or [row.get("track_id")]
        track_ids = [tid for tid in (_safe_int(tid) for tid in track_ids) if tid is not None]
        jersey = _safe_int(row.get("jersey"))
        if jersey is None:
            for tid in track_ids:
                jersey = _safe_int((tracks_by_id.get(tid) or {}).get("jersey"))
                if jersey is not None:
                    break
        team = row.get("team")
        team_label = f"Equipo {team}" if team else None
        events = []
        for tid in track_ids:
            intensity = (tracks_by_id.get(tid) or {}).get("intensity") or {}
            for ev in intensity.get("events") or []:
                events.append(ev)

        if events:
            for ev in sorted(events, key=lambda e: _safe_float(e.get("start_t"), 0.0)):
                start = max(0.0, _safe_float(ev.get("start_t"), 0.0) - 2.0)
                raw_end = _safe_float(ev.get("end_t"), start + 2.0) + 2.0
                end = min(duration, raw_end) if duration > 0 else raw_end
                if end <= start:
                    end = start + 6.0
                candidates.append({
                    "action_type": _cv_action_label(ev.get("kind")),
                    "start_s": round(start, 2),
                    "end_s": round(end, 2),
                    "event_s": round((start + end) / 2, 2),
                    "jersey": jersey,
                    "team_label": team_label,
                    "track_ids": track_ids,
                    "note": f"Importado desde CV: tracks={track_ids}; evento={ev}",
                })
        else:
            distance = _safe_float(row.get("distance_m"), _safe_float(row.get("total_distance_m"), 0.0))
            top_speed = _safe_float(row.get("top_speed_kmh"), _safe_float(row.get("max_speed_kmh"), 0.0))
            if distance < 5 and top_speed < 5:
                continue
            end = min(duration, 30.0) if duration > 0 else 30.0
            candidates.append({
                "action_type": "Resumen CV",
                "start_s": 0.0,
                "end_s": max(6.0, end),
                "event_s": 0.0,
                "jersey": jersey,
                "team_label": team_label,
                "track_ids": track_ids,
                "note": f"Importado desde CV: tracks={track_ids}; distancia={distance:.1f}m, vel_max={top_speed:.1f}km/h",
            })

    return candidates[:200]


def _clip_exists(db: Session, analysis_id: int, player_id: int | None, action_type: str, start_s: float, end_s: float, note: str | None) -> bool:
    q = db.query(VideoClip).filter(
        VideoClip.video_analysis_id == analysis_id,
        VideoClip.action_type == action_type,
        VideoClip.start_s == start_s,
        VideoClip.end_s == end_s,
        VideoClip.note == note,
    )
    if player_id is None:
        q = q.filter(VideoClip.player_id.is_(None))
    else:
        q = q.filter(VideoClip.player_id == player_id)
    return q.first() is not None

def _clip_title(action_type: str, event_s: float, player: Player | None) -> str:
    minute = int(event_s // 60)
    second = int(event_s % 60)
    who = player.full_name if player else "Sin jugador asignado"
    return f"{action_type} - {who} - {minute:02d}:{second:02d}"

@router.get("/summary", response_model=VideoLabSummary)
def summary(
    match_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    clips_q = scoped_query(db.query(VideoClip), VideoClip, current_user)
    tags_q = scoped_query(db.query(VideoTag), VideoTag, current_user)
    playlists_q = scoped_query(db.query(VideoPlaylist), VideoPlaylist, current_user)
    if match_id:
        _get_scoped(Match, match_id, db, current_user)
        clips_q = clips_q.filter(VideoClip.match_id == match_id)
        tags_q = tags_q.filter(VideoTag.match_id == match_id)

    players_tagged = clips_q.filter(VideoClip.player_id.isnot(None)).with_entities(VideoClip.player_id).distinct().count()
    return VideoLabSummary(
        clips=clips_q.count(),
        tags=tags_q.count(),
        players_tagged=players_tagged,
        playlists=playlists_q.count(),
        exported_clips=clips_q.filter(VideoClip.status == VideoClipStatus.READY).count(),
        unassigned_clips=clips_q.filter(VideoClip.player_id.is_(None)).count(),
    )


@router.post("/import-cv/{analysis_id}", response_model=VideoLabImportResult)
def import_cv_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
):
    analysis = _get_scoped(VideoAnalysis, analysis_id, db, current_user)
    if analysis.status != CVStatus.DONE or not analysis.results:
        raise HTTPException(status_code=400, detail="El analisis CV aun no tiene resultados listos")

    candidates = _cv_candidates(analysis)
    if not candidates:
        raise HTTPException(status_code=400, detail="El analisis CV no trae tracks/eventos suficientes para crear clips")

    players = scoped_query(db.query(Player), Player, current_user).filter(Player.jersey_number.isnot(None)).all()
    by_jersey = {int(p.jersey_number): p for p in players if p.jersey_number is not None}
    created_tags = 0
    created_clips = 0
    matched_players = set()
    skipped_existing = 0

    for cand in candidates:
        player = by_jersey.get(cand.get("jersey"))
        player_id = player.id if player else None
        if _clip_exists(db, analysis.id, player_id, cand["action_type"], cand["start_s"], cand["end_s"], cand.get("note")):
            skipped_existing += 1
            continue
        if player_id:
            matched_players.add(player_id)
        who = player.full_name if player else (f"Dorsal #{cand['jersey']}" if cand.get("jersey") else f"Track {','.join(map(str, cand.get('track_ids') or []))}")
        tag = VideoTag(
            club_id=analysis.club_id,
            match_id=analysis.match_id,
            video_analysis_id=analysis.id,
            player_id=player_id,
            created_by=current_user.id,
            action_type=cand["action_type"],
            team_label=cand.get("team_label"),
            event_s=cand["event_s"],
            start_s=cand["start_s"],
            end_s=cand["end_s"],
            confidence=0.65 if player_id else 0.35,
            source=VideoTagSource.IMPORT,
            status=VideoTagStatus.SUGGESTED,
            note=cand.get("note"),
        )
        db.add(tag)
        db.flush()
        clip = VideoClip(
            club_id=analysis.club_id,
            tag_id=tag.id,
            match_id=analysis.match_id,
            video_analysis_id=analysis.id,
            player_id=player_id,
            created_by=current_user.id,
            title=f"{cand['action_type']} - {who}",
            action_type=cand["action_type"],
            team_label=cand.get("team_label"),
            start_s=cand["start_s"],
            end_s=cand["end_s"],
            duration_s=max(0.0, cand["end_s"] - cand["start_s"]),
            status=VideoClipStatus.VIRTUAL,
            note=cand.get("note"),
        )
        db.add(clip)
        created_tags += 1
        created_clips += 1

    db.commit()
    return VideoLabImportResult(
        analysis_id=analysis.id,
        total_candidates=len(candidates),
        created_tags=created_tags,
        created_clips=created_clips,
        matched_players=len(matched_players),
        skipped_existing=skipped_existing,
    )

@router.get("/clips", response_model=List[VideoClipOut])
def list_clips(
    match_id: Optional[int] = None,
    player_id: Optional[int] = None,
    action_type: Optional[str] = None,
    unassigned: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = scoped_query(db.query(VideoClip), VideoClip, current_user)
    if match_id:
        _get_scoped(Match, match_id, db, current_user)
        q = q.filter(VideoClip.match_id == match_id)
    if player_id:
        _get_scoped(Player, player_id, db, current_user)
        q = q.filter(VideoClip.player_id == player_id)
    if action_type:
        q = q.filter(func.lower(VideoClip.action_type) == action_type.lower())
    if unassigned:
        q = q.filter(VideoClip.player_id.is_(None))
    rows = q.order_by(VideoClip.created_at.desc()).offset(skip).limit(limit).all()
    return [_clip_out(row) for row in rows]

@router.post("/tags", response_model=VideoTagOut, status_code=status.HTTP_201_CREATED)
def create_tag(
    data: VideoTagCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
    club_id: int = Depends(get_current_club_id),
):
    _, _, player = _gate_optional_refs(
        db,
        current_user,
        match_id=data.match_id,
        video_analysis_id=data.video_analysis_id,
        player_id=data.player_id,
    )
    tag = VideoTag(
        club_id=club_id,
        match_id=data.match_id,
        video_analysis_id=data.video_analysis_id,
        player_id=data.player_id,
        created_by=current_user.id,
        action_type=data.action_type.strip(),
        phase=data.phase,
        team_label=data.team_label,
        event_s=data.event_s,
        start_s=data.start_s,
        end_s=data.end_s,
        pitch_x=data.pitch_x,
        pitch_y=data.pitch_y,
        confidence=data.confidence,
        source=VideoTagSource(data.source),
        status=VideoTagStatus(data.status),
        note=data.note,
        color=data.color,
    )
    db.add(tag)
    db.flush()

    clip = VideoClip(
        club_id=club_id,
        tag_id=tag.id,
        match_id=data.match_id,
        video_analysis_id=data.video_analysis_id,
        player_id=data.player_id,
        created_by=current_user.id,
        title=_clip_title(data.action_type.strip(), data.event_s, player),
        action_type=data.action_type.strip(),
        team_label=data.team_label,
        start_s=data.start_s,
        end_s=data.end_s,
        duration_s=data.end_s - data.start_s,
        status=VideoClipStatus.VIRTUAL,
        note=data.note,
    )
    db.add(clip)
    db.commit()
    db.refresh(tag)
    return _tag_out(tag)

@router.patch("/tags/{tag_id}", response_model=VideoTagOut)
def update_tag(
    tag_id: int,
    data: VideoTagUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
):
    tag = _get_scoped(VideoTag, tag_id, db, current_user)
    payload = data.model_dump(exclude_unset=True)
    if "player_id" in payload and payload["player_id"]:
        _get_scoped(Player, payload["player_id"], db, current_user)
    for key, value in payload.items():
        if key in {"source", "status"} and value is not None:
            value = VideoTagStatus(value) if key == "status" else VideoTagSource(value)
        setattr(tag, key, value)
    for clip in tag.clips:
        if "player_id" in payload:
            clip.player_id = payload["player_id"]
        if "action_type" in payload and payload["action_type"]:
            clip.action_type = payload["action_type"]
        if "team_label" in payload:
            clip.team_label = payload["team_label"]
        if "start_s" in payload and payload["start_s"] is not None:
            clip.start_s = payload["start_s"]
        if "end_s" in payload and payload["end_s"] is not None:
            clip.end_s = payload["end_s"]
        clip.duration_s = max(0.0, clip.end_s - clip.start_s)
    db.commit()
    db.refresh(tag)
    return _tag_out(tag)

@router.post("/clips", response_model=VideoClipOut, status_code=status.HTTP_201_CREATED)
def create_clip(
    data: VideoClipCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
    club_id: int = Depends(get_current_club_id),
):
    _gate_optional_refs(db, current_user, match_id=data.match_id, video_analysis_id=data.video_analysis_id, player_id=data.player_id)
    clip = VideoClip(
        club_id=club_id,
        match_id=data.match_id,
        video_analysis_id=data.video_analysis_id,
        player_id=data.player_id,
        created_by=current_user.id,
        title=data.title.strip(),
        action_type=data.action_type,
        team_label=data.team_label,
        start_s=data.start_s,
        end_s=data.end_s,
        duration_s=data.end_s - data.start_s,
        status=VideoClipStatus.VIRTUAL,
        note=data.note,
    )
    db.add(clip)
    db.commit()
    db.refresh(clip)
    return _clip_out(clip)

@router.patch("/clips/{clip_id}", response_model=VideoClipOut)
def update_clip(
    clip_id: int,
    data: VideoClipUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
):
    clip = _get_scoped(VideoClip, clip_id, db, current_user)
    payload = data.model_dump(exclude_unset=True)
    if "player_id" in payload and payload["player_id"]:
        _get_scoped(Player, payload["player_id"], db, current_user)
    for key, value in payload.items():
        setattr(clip, key, value)
    if clip.end_s <= clip.start_s:
        raise HTTPException(status_code=400, detail="end_s debe ser mayor que start_s")
    clip.duration_s = clip.end_s - clip.start_s
    db.commit()
    db.refresh(clip)
    return _clip_out(clip)

@router.post("/clips/{clip_id}/export", response_model=VideoClipOut)
def export_clip(
    clip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
):
    clip = _get_scoped(VideoClip, clip_id, db, current_user)
    if not clip.video_analysis_id or not clip.video_analysis:
        raise HTTPException(status_code=400, detail="El clip no tiene video fuente asociado")
    source = clip.video_analysis.video_path
    if not source or not os.path.exists(source):
        raise HTTPException(status_code=404, detail="Video fuente no disponible en el servidor")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(status_code=503, detail="FFmpeg no esta instalado en el servidor")

    base_dir = clip.video_analysis.output_dir or os.path.join(os.path.dirname(source), "video_lab")
    out_dir = os.path.join(base_dir, "clips")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"clip_{clip.id}.mp4")
    clip.status = VideoClipStatus.EXPORTING
    clip.export_error = None
    db.commit()

    cmd = [
        ffmpeg,
        "-y",
        "-ss",
        f"{clip.start_s:.3f}",
        "-i",
        source,
        "-t",
        f"{clip.duration_s:.3f}",
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        out_path,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=180)
        clip.output_path = out_path
        clip.status = VideoClipStatus.READY
    except Exception as exc:
        clip.status = VideoClipStatus.FAILED
        clip.export_error = str(exc)[:2000]
    db.commit()
    db.refresh(clip)
    return _clip_out(clip)

@router.get("/clips/{clip_id}/file")
def clip_file(clip_id: int, token: Optional[str] = None, db: Session = Depends(get_db)):
    from ....core.security import decode_token

    user = None
    if token:
        payload = decode_token(token)
        if payload and payload.get("type") == "access" and payload.get("sub"):
            user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Token invalido o expirado")

    clip = _get_scoped(VideoClip, clip_id, db, user)
    if clip.status != VideoClipStatus.READY or not clip.output_path or not os.path.exists(clip.output_path):
        raise HTTPException(status_code=404, detail="Archivo de clip no disponible")
    return FileResponse(clip.output_path, media_type="video/mp4", filename=f"clip_{clip.id}.mp4")

@router.get("/playlists", response_model=List[VideoPlaylistOut])
def list_playlists(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = scoped_query(db.query(VideoPlaylist), VideoPlaylist, current_user).order_by(VideoPlaylist.created_at.desc()).all()
    return [_playlist_out(row) for row in rows]

@router.post("/playlists", response_model=VideoPlaylistOut, status_code=status.HTTP_201_CREATED)
def create_playlist(
    data: VideoPlaylistCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
    club_id: int = Depends(get_current_club_id),
):
    playlist = VideoPlaylist(
        club_id=club_id,
        created_by=current_user.id,
        title=data.title.strip(),
        description=data.description,
        purpose=data.purpose,
        is_shared=data.is_shared,
        share_token=secrets.token_urlsafe(18) if data.is_shared else None,
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return _playlist_out(playlist)

@router.get("/playlists/{playlist_id}", response_model=VideoPlaylistDetailOut)
def get_playlist(playlist_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    playlist = _get_scoped(VideoPlaylist, playlist_id, db, current_user)
    return _playlist_detail_out(playlist)

@router.patch("/playlists/{playlist_id}", response_model=VideoPlaylistOut)
def update_playlist(
    playlist_id: int,
    data: VideoPlaylistUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
):
    playlist = _get_scoped(VideoPlaylist, playlist_id, db, current_user)
    payload = data.model_dump(exclude_unset=True)
    if "is_shared" in payload:
        playlist.is_shared = bool(payload.pop("is_shared"))
        if playlist.is_shared and not playlist.share_token:
            playlist.share_token = secrets.token_urlsafe(18)
        if not playlist.is_shared:
            playlist.share_token = None
    for key, value in payload.items():
        setattr(playlist, key, value)
    db.commit()
    db.refresh(playlist)
    return _playlist_out(playlist)

@router.get("/share/{share_token}", response_model=VideoPlaylistDetailOut)
def get_shared_playlist(share_token: str, db: Session = Depends(get_db)):
    playlist = db.query(VideoPlaylist).filter(
        VideoPlaylist.share_token == share_token,
        VideoPlaylist.is_shared.is_(True),
    ).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist compartida no encontrada")
    return _playlist_detail_out(playlist)

@router.get("/share/{share_token}/clips/{clip_id}/file")
def shared_clip_file(share_token: str, clip_id: int, db: Session = Depends(get_db)):
    playlist = db.query(VideoPlaylist).filter(
        VideoPlaylist.share_token == share_token,
        VideoPlaylist.is_shared.is_(True),
    ).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist compartida no encontrada")
    item = db.query(VideoPlaylistItem).filter(
        VideoPlaylistItem.playlist_id == playlist.id,
        VideoPlaylistItem.clip_id == clip_id,
    ).first()
    if not item or not item.clip:
        raise HTTPException(status_code=404, detail="Clip no pertenece a esta playlist")
    clip = item.clip
    if clip.status != VideoClipStatus.READY or not clip.output_path or not os.path.exists(clip.output_path):
        raise HTTPException(status_code=404, detail="Archivo de clip no disponible")
    return FileResponse(clip.output_path, media_type="video/mp4", filename=f"clip_{clip.id}.mp4")

@router.post("/playlists/{playlist_id}/clips", response_model=VideoPlaylistOut)
def add_clip_to_playlist(
    playlist_id: int,
    data: AddClipToPlaylist,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.COACH, UserRole.ANALYST)),
):
    playlist = _get_scoped(VideoPlaylist, playlist_id, db, current_user)
    _get_scoped(VideoClip, data.clip_id, db, current_user)
    existing = db.query(VideoPlaylistItem).filter(
        VideoPlaylistItem.playlist_id == playlist_id,
        VideoPlaylistItem.clip_id == data.clip_id,
    ).first()
    if not existing:
        db.add(VideoPlaylistItem(
            playlist_id=playlist_id,
            clip_id=data.clip_id,
            sort_order=data.sort_order,
            note=data.note,
        ))
    db.commit()
    db.refresh(playlist)
    return _playlist_out(playlist)
