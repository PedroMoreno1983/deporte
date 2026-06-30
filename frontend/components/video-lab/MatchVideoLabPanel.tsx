"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Download, Film, Loader2, Play, Plus, Tag, Users } from "lucide-react";
import { toast } from "sonner";
import { cvApi, videoLabApi, type VideoLabClip } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";

const ACTIONS = ["Pase", "Tiro", "Gol", "Recuperacion", "Perdida", "Presion", "Centro", "Duelo", "Falta", "Transicion"];

function timeLabel(seconds?: number | null) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function playerName(player: any) {
  return `${player.jersey_number ? `#${player.jersey_number} ` : ""}${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
}

export function MatchVideoLabPanel({ matchId, players }: { matchId: number; players: any[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ action_type: "Pase", event_s: "0", clip_margin_s: "6", player_id: "", video_analysis_id: "", note: "" });

  const { data: summary } = useQuery({
    queryKey: ["video-lab-summary", matchId],
    queryFn: () => videoLabApi.summary({ match_id: matchId }),
  });
  const { data: clips = [], isLoading } = useQuery({
    queryKey: ["video-lab-clips", matchId],
    queryFn: () => videoLabApi.clips({ match_id: matchId, limit: 80 }),
  });
  const { data: videos = [] } = useQuery({
    queryKey: ["cv-match", matchId],
    queryFn: () => cvApi.list({ match_id: matchId }),
  });

  const activePlayers = useMemo(() => players.filter((p) => p.is_active !== false), [players]);

  const createTag = useMutation({
    mutationFn: () => videoLabApi.createTag({
      match_id: matchId,
      video_analysis_id: form.video_analysis_id ? Number(form.video_analysis_id) : undefined,
      player_id: form.player_id ? Number(form.player_id) : undefined,
      action_type: form.action_type,
      event_s: Number(form.event_s || 0),
      clip_margin_s: Number(form.clip_margin_s || 6),
      team_label: "Propio",
      note: form.note || undefined,
      source: "manual",
      status: "confirmed",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-lab-summary", matchId] });
      qc.invalidateQueries({ queryKey: ["video-lab-clips", matchId] });
      setForm((f) => ({ ...f, note: "" }));
      toast.success("Tag agregado al partido");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo crear el tag"),
  });

  const updateClip = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => videoLabApi.updateClip(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-lab-clips", matchId] });
      qc.invalidateQueries({ queryKey: ["video-lab-summary", matchId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo actualizar el clip"),
  });

  const exportClip = useMutation({
    mutationFn: (clip: VideoLabClip) => videoLabApi.exportClip(clip.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-lab-clips", matchId] });
      toast.success("Export revisado");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo exportar el clip"),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <Film className="w-4 h-4" style={{ color: "#00ff87" }} />
          Video Lab del partido
          <span className="text-xs font-normal opacity-40 ml-1">{summary?.clips ?? clips.length} clips</span>
        </h3>
        <Link href={`/video-lab?match_id=${matchId}`} className="text-xs px-3 py-2 rounded-xl" style={{ color: "#00ff87", background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.22)" }}>
          Abrir laboratorio completo
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
        <div className="rounded-xl px-3 py-2 bg-white/[0.03] border border-white/[0.06]"><p className="text-lg font-black text-white">{summary?.tags ?? 0}</p><p className="text-[10px] uppercase text-white/30">tags</p></div>
        <div className="rounded-xl px-3 py-2 bg-white/[0.03] border border-white/[0.06]"><p className="text-lg font-black text-white">{summary?.players_tagged ?? 0}</p><p className="text-[10px] uppercase text-white/30">jugadores</p></div>
        <div className="rounded-xl px-3 py-2 bg-white/[0.03] border border-white/[0.06]"><p className="text-lg font-black text-white">{summary?.exported_clips ?? 0}</p><p className="text-[10px] uppercase text-white/30">exportados</p></div>
        <div className="rounded-xl px-3 py-2 bg-white/[0.03] border border-white/[0.06]"><p className="text-lg font-black text-white">{summary?.unassigned_clips ?? 0}</p><p className="text-[10px] uppercase text-white/30">sin asignar</p></div>
        <div className="rounded-xl px-3 py-2 bg-white/[0.03] border border-white/[0.06]"><p className="text-lg font-black text-white">{summary?.playlists ?? 0}</p><p className="text-[10px] uppercase text-white/30">playlists</p></div>
      </div>

      <GlowCard className="p-4 rounded-2xl mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <select value={form.action_type} onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value }))} className="input text-xs">
            {ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <input type="number" min={0} step={0.5} value={form.event_s} onChange={(e) => setForm((f) => ({ ...f, event_s: e.target.value }))} className="input text-xs" placeholder="segundo" />
          <input type="number" min={1} max={30} value={form.clip_margin_s} onChange={(e) => setForm((f) => ({ ...f, clip_margin_s: e.target.value }))} className="input text-xs" placeholder="margen" />
          <select value={form.player_id} onChange={(e) => setForm((f) => ({ ...f, player_id: e.target.value }))} className="input text-xs">
            <option value="">Sin jugador</option>
            {activePlayers.map((p) => <option key={p.id} value={p.id}>{playerName(p)}</option>)}
          </select>
          <select value={form.video_analysis_id} onChange={(e) => setForm((f) => ({ ...f, video_analysis_id: e.target.value }))} className="input text-xs">
            <option value="">Sin video fuente</option>
            {(videos as any[]).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <button onClick={() => createTag.mutate()} disabled={createTag.isPending} className="btn-primary text-xs justify-center">
            {createTag.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Tag
          </button>
        </div>
      </GlowCard>

      {isLoading ? null : clips.length === 0 ? (
        <div className="p-7 text-center text-white/40 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <Tag className="w-8 h-8 mx-auto mb-2 text-white/20" />
          <p className="text-sm font-semibold text-white/75">Sin clips analizados en este partido</p>
          <p className="text-xs text-white/35 mt-1">Crea tags con jugador y segundo de video para llenar la biblioteca.</p>
        </div>
      ) : (
        <GlowCard className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Clip", "Jugador", "Accion", "Ventana", "Estado", "Acciones"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clips.slice(0, 12).map((clip) => (
                  <tr key={clip.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-semibold text-white/85">{clip.title}</td>
                    <td className="px-4 py-3">
                      <select value={clip.player_id ?? ""} onChange={(e) => updateClip.mutate({ id: clip.id, data: { player_id: e.target.value ? Number(e.target.value) : null } })} className="input text-xs min-w-[180px]">
                        <option value="">Sin jugador</option>
                        {activePlayers.map((p) => <option key={p.id} value={p.id}>{playerName(p)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3"><span className="chip">{clip.action_type || "clip"}</span></td>
                    <td className="px-4 py-3 tabular-nums text-white/50">{timeLabel(clip.start_s)}-{timeLabel(clip.end_s)}</td>
                    <td className="px-4 py-3 text-white/50">{clip.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => window.open(videoLabApi.clipFileUrl(clip.id), "_blank")} disabled={clip.status !== "ready"} className="theme-toggle" title="Reproducir"><Play className="w-3.5 h-3.5" /></button>
                        <button onClick={() => exportClip.mutate(clip)} disabled={!clip.video_analysis_id || exportClip.isPending} className="theme-toggle" title="Exportar"><Download className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlowCard>
      )}
    </div>
  );
}