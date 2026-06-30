"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clapperboard, Download, Film, ListVideo, Loader2, MousePointer2, Play, Plus, Search, Sparkles, Tag, Users } from "lucide-react";
import { toast } from "sonner";
import { cvApi, matchesApi, playersApi, videoLabApi, type VideoLabClip } from "@/lib/api";
import { PageTitle, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

const ACTIONS = ["Pase", "Tiro", "Gol", "Recuperacion", "Perdida", "Presion", "Centro", "Duelos", "Falta", "Transicion"];
const TEAM_OPTIONS = ["Propio", "Rival", "Neutro"];

function timeLabel(seconds?: number | null) {
  const s = Math.max(0, Math.round(seconds || 0));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function playerLabel(player: any) {
  const name = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
  return `${player.jersey_number ? `#${player.jersey_number} ` : ""}${name}`;
}

export default function VideoLabPage() {
  const qc = useQueryClient();
  const [matchId, setMatchId] = useState("all");
  const [videoId, setVideoId] = useState("");
  const [playerId, setPlayerId] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [playlistId, setPlaylistId] = useState("");
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [tagForm, setTagForm] = useState({ action_type: "Pase", event_s: "0", clip_margin_s: "6", player_id: "", team_label: "Propio", note: "" });
  const [pitch, setPitch] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryMatchId = params.get("match_id");
    const queryPlayerId = params.get("player_id");
    if (queryMatchId) setMatchId(queryMatchId);
    if (queryPlayerId) setPlayerId(queryPlayerId);
  }, []);
  const selectedMatchId = matchId === "all" ? undefined : Number(matchId);
  const selectedPlayerId = playerId === "all" ? undefined : Number(playerId);
  const selectedVideoId = videoId ? Number(videoId) : undefined;
  const selectedAction = actionFilter === "all" ? undefined : actionFilter;

  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: () => matchesApi.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players", "video-lab"], queryFn: () => playersApi.list({ limit: 500 }) });
  const { data: videos = [] } = useQuery({
    queryKey: ["cv", "video-lab", selectedMatchId],
    queryFn: () => cvApi.list(selectedMatchId ? { match_id: selectedMatchId } : undefined),
  });
  const { data: summary } = useQuery({
    queryKey: ["video-lab-summary", selectedMatchId],
    queryFn: () => videoLabApi.summary(selectedMatchId ? { match_id: selectedMatchId } : undefined),
  });
  const { data: clips = [], isLoading: clipsLoading } = useQuery({
    queryKey: ["video-lab-clips", selectedMatchId, selectedPlayerId, selectedAction],
    queryFn: () => videoLabApi.clips({ match_id: selectedMatchId, player_id: selectedPlayerId, action_type: selectedAction, limit: 150 }),
  });
  const { data: playlists = [] } = useQuery({ queryKey: ["video-lab-playlists"], queryFn: videoLabApi.playlists });

  const selectedVideo = useMemo(() => (videos as any[]).find((v) => v.id === selectedVideoId), [videos, selectedVideoId]);
  const activePlayers = useMemo(() => (players as any[]).filter((p) => p.is_active !== false), [players]);

  const createTag = useMutation({
    mutationFn: () => videoLabApi.createTag({
      match_id: selectedMatchId,
      video_analysis_id: selectedVideoId,
      player_id: tagForm.player_id ? Number(tagForm.player_id) : undefined,
      action_type: tagForm.action_type,
      event_s: Number(tagForm.event_s || 0),
      clip_margin_s: Number(tagForm.clip_margin_s || 6),
      team_label: tagForm.team_label,
      note: tagForm.note || undefined,
      pitch_x: pitch?.x,
      pitch_y: pitch?.y,
      source: "manual",
      status: "confirmed",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-lab-summary"] });
      qc.invalidateQueries({ queryKey: ["video-lab-clips"] });
      setTagForm((f) => ({ ...f, note: "" }));
      toast.success("Tag creado y clip agregado a la biblioteca");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo crear el tag"),
  });

  const updateClip = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => videoLabApi.updateClip(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-lab-summary"] });
      qc.invalidateQueries({ queryKey: ["video-lab-clips"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo actualizar el clip"),
  });

  const exportClip = useMutation({
    mutationFn: (clip: VideoLabClip) => videoLabApi.exportClip(clip.id),
    onSuccess: (clip) => {
      qc.invalidateQueries({ queryKey: ["video-lab-clips"] });
      toast.success(clip.status === "ready" ? "Clip exportado" : "Export solicitado");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo exportar el clip"),
  });

  const createPlaylist = useMutation({
    mutationFn: () => videoLabApi.createPlaylist({ title: playlistTitle, purpose: "analisis" }),
    onSuccess: (playlist) => {
      setPlaylistTitle("");
      setPlaylistId(String(playlist.id));
      qc.invalidateQueries({ queryKey: ["video-lab-playlists"] });
      toast.success("Playlist creada");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo crear la playlist"),
  });

  const addToPlaylist = useMutation({
    mutationFn: (clipId: number) => videoLabApi.addClipToPlaylist(Number(playlistId), { clip_id: clipId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-lab-playlists"] });
      toast.success("Clip agregado a la playlist");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo agregar el clip"),
  });

  const onPitchClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPitch({
      x: Math.round(((event.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((event.clientY - rect.top) / rect.height) * 100),
    });
  };

  return (
    <div className="screen" style={{ maxWidth: 1240 }}>
      <PageTitle title="Video Lab" subtitle="tagging profesional, clips consolidados y playlists de analisis">
        <span className="chip is-on"><Sparkles className="w-3.5 h-3.5" /> Neural-ready</span>
      </PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3" style={{ marginBottom: 14 }}>
        {[
          { label: "Clips", value: summary?.clips ?? 0, icon: Film },
          { label: "Tags", value: summary?.tags ?? 0, icon: Tag },
          { label: "Jugadores", value: summary?.players_tagged ?? 0, icon: Users },
          { label: "Exportados", value: summary?.exported_clips ?? 0, icon: Download },
          { label: "Sin asignar", value: summary?.unassigned_clips ?? 0, icon: Search },
          { label: "Playlists", value: summary?.playlists ?? 0, icon: ListVideo },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="stat-card" style={{ minHeight: 86 }}>
              <div className="stat-icon"><Icon className="w-4 h-4" /></div>
              <div className="stat-value">{kpi.value}</div>
              <div className="stat-label">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
        <Card kicker="sala de corte" title="Taggear jugada">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
            <div>
              <Note style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Partido</Note>
              <select value={matchId} onChange={(e) => { setMatchId(e.target.value); setVideoId(""); }} className="input" style={{ width: "100%" }}>
                <option value="all">Todos los partidos</option>
                {(matches as any[]).map((m) => <option key={m.id} value={m.id}>{m.date} vs {m.opponent}</option>)}
              </select>
            </div>
            <div>
              <Note style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Video fuente</Note>
              <select value={videoId} onChange={(e) => setVideoId(e.target.value)} className="input" style={{ width: "100%" }}>
                <option value="">Sin video asociado</option>
                {(videos as any[]).map((v) => <option key={v.id} value={v.id}>{v.name} · {v.status}</option>)}
              </select>
            </div>
            <div>
              <Note style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Jugador</Note>
              <select value={tagForm.player_id} onChange={(e) => setTagForm((f) => ({ ...f, player_id: e.target.value }))} className="input" style={{ width: "100%" }}>
                <option value="">Sin jugador asignado</option>
                {activePlayers.map((p: any) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
              </select>
            </div>
          </div>

          {selectedVideo ? (
            <video controls src={cvApi.outputVideoUrl(selectedVideo.id)} style={{ width: "100%", aspectRatio: "16 / 9", background: "#111", borderRadius: 8, marginBottom: 12 }} />
          ) : (
            <div className="empty-state" style={{ minHeight: 210, marginBottom: 12 }}>
              <Clapperboard className="w-8 h-8" />
              <div>Selecciona un video procesado o taggea manualmente desde el tiempo del partido.</div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2" style={{ marginBottom: 12 }}>
            <select value={tagForm.action_type} onChange={(e) => setTagForm((f) => ({ ...f, action_type: e.target.value }))} className="input">
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={tagForm.team_label} onChange={(e) => setTagForm((f) => ({ ...f, team_label: e.target.value }))} className="input">
              {TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" min={0} step={0.5} value={tagForm.event_s} onChange={(e) => setTagForm((f) => ({ ...f, event_s: e.target.value }))} className="input" placeholder="segundo" />
            <input type="number" min={1} max={30} value={tagForm.clip_margin_s} onChange={(e) => setTagForm((f) => ({ ...f, clip_margin_s: e.target.value }))} className="input" placeholder="margen" />
            <button onClick={() => createTag.mutate()} disabled={createTag.isPending} className="btn-primary text-sm">
              {createTag.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear tag
            </button>
          </div>

          <textarea rows={2} value={tagForm.note} onChange={(e) => setTagForm((f) => ({ ...f, note: e.target.value }))} className="input" style={{ width: "100%", resize: "none", marginBottom: 12 }} placeholder="Nota tecnica del clip" />

          <div onClick={onPitchClick} style={{ position: "relative", aspectRatio: "16 / 10", border: "1px solid var(--rule)", borderRadius: 8, background: "linear-gradient(90deg, rgba(39,118,72,.12), rgba(39,118,72,.2))", overflow: "hidden", cursor: "crosshair" }}>
            <div style={{ position: "absolute", inset: "8% 6%", border: "1px solid rgba(39,118,72,.55)" }} />
            <div style={{ position: "absolute", left: "50%", top: "8%", bottom: "8%", borderLeft: "1px solid rgba(39,118,72,.45)" }} />
            <div style={{ position: "absolute", left: "42%", top: "38%", width: "16%", aspectRatio: "1", border: "1px solid rgba(39,118,72,.45)", borderRadius: "50%" }} />
            {pitch && <div style={{ position: "absolute", left: `${pitch.x}%`, top: `${pitch.y}%`, transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: 999, background: "var(--terracotta)", boxShadow: "0 0 0 5px rgba(37,99,235,.14)" }} />}
            <div style={{ position: "absolute", left: 12, bottom: 10 }} className="chip"><MousePointer2 className="w-3.5 h-3.5" /> {pitch ? `Zona ${pitch.x}, ${pitch.y}` : "Click para ubicar jugada"}</div>
          </div>
        </Card>

        <Card kicker="colecciones" title="Playlists de analisis">
          <div className="filter-bar" style={{ marginBottom: 12 }}>
            <input value={playlistTitle} onChange={(e) => setPlaylistTitle(e.target.value)} className="input" placeholder="Nueva playlist" style={{ flex: 1 }} />
            <button onClick={() => createPlaylist.mutate()} disabled={!playlistTitle.trim() || createPlaylist.isPending} className="chip is-on">
              {createPlaylist.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Crear
            </button>
          </div>
          <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)} className="input" style={{ width: "100%", marginBottom: 12 }}>
            <option value="">Seleccionar playlist activa</option>
            {playlists.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.clips_count} clips</option>)}
          </select>
          <div className="inj-list">
            {playlists.map((p) => (
              <div className="inj-row" key={p.id}>
                <ListVideo className="w-4 h-4" style={{ color: "var(--terracotta)" }} />
                <span className="inj-player" style={{ cursor: "default" }}>{p.title}</span>
                <span className="inj-region">{p.purpose || "analisis"}</span>
                <span className="inj-month">{p.clips_count} clips</span>
              </div>
            ))}
            {!playlists.length && <Note>Aun no hay playlists.</Note>}
          </div>
        </Card>
      </div>

      <Card kicker="biblioteca consolidada" title="Todos los clips" note={`${clips.length} visibles`}>
        <div className="filter-bar" style={{ marginBottom: 12 }}>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="input">
            <option value="all">Todos los jugadores</option>
            {activePlayers.map((p: any) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input">
            <option value="all">Todas las acciones</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="chip"><Search className="w-3.5 h-3.5" /> {summary?.unassigned_clips ?? 0} sin jugador</span>
        </div>

        <div className="inj-list">
          {clipsLoading && <Note>Cargando clips...</Note>}
          {clips.map((clip) => (
            <div className="inj-row" key={clip.id} style={{ alignItems: "center", gap: 10 }}>
              <button className="theme-toggle" title="Reproducir clip exportado" disabled={clip.status !== "ready"} onClick={() => window.open(videoLabApi.clipFileUrl(clip.id), "_blank")}>
                <Play className="w-4 h-4" />
              </button>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="inj-player" style={{ cursor: "default" }}>{clip.title}</div>
                <Note style={{ fontSize: 13 }}>{clip.match_label || "sin partido"} · {timeLabel(clip.start_s)}-{timeLabel(clip.end_s)} · {clip.video_name || "sin video fuente"}</Note>
              </div>
              <select value={clip.player_id ?? ""} onChange={(e) => updateClip.mutate({ id: clip.id, data: { player_id: e.target.value ? Number(e.target.value) : null } })} className="input" style={{ width: 210 }}>
                <option value="">Sin jugador asignado</option>
                {activePlayers.map((p: any) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
              </select>
              <span className="chip">{clip.action_type || "clip"}</span>
              <span className="chip" style={{ color: clip.status === "ready" ? "var(--pine)" : clip.status === "failed" ? "var(--terracotta)" : "var(--ink-soft)" }}>{clip.status}</span>
              <button onClick={() => exportClip.mutate(clip)} disabled={!clip.video_analysis_id || exportClip.isPending} className="chip">
                {exportClip.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Exportar
              </button>
              <button onClick={() => addToPlaylist.mutate(clip.id)} disabled={!playlistId || addToPlaylist.isPending} className="chip is-on">
                <Check className="w-3.5 h-3.5" /> Playlist
              </button>
            </div>
          ))}
          {!clipsLoading && !clips.length && <Note>No hay clips con esos filtros.</Note>}
        </div>
      </Card>
    </div>
  );
}