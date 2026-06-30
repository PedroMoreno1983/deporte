"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Download, Film, Loader2, Play, Search } from "lucide-react";
import { toast } from "sonner";
import { videoLabApi, type VideoLabClip } from "@/lib/api";
import { Card } from "@/components/ui/Card";

function timeLabel(seconds?: number | null) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function PlayerClipsPanel({ playerId, playerName }: { playerId: number; playerName: string }) {
  const qc = useQueryClient();
  const { data: clips = [], isLoading } = useQuery({
    queryKey: ["video-lab-clips", "player", playerId],
    queryFn: () => videoLabApi.clips({ player_id: playerId, limit: 120 }),
  });

  const exportClip = useMutation({
    mutationFn: (clip: VideoLabClip) => videoLabApi.exportClip(clip.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-lab-clips", "player", playerId] });
      toast.success("Clip exportado o revisado");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "No se pudo exportar el clip"),
  });

  const byAction = clips.reduce<Record<string, number>>((acc, clip) => {
    const key = clip.action_type || "Clip";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-2xl font-bold text-white">{clips.length}</p><p className="text-xs text-white/30 mt-1">Clips totales</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-white">{clips.filter((c) => c.status === "ready").length}</p><p className="text-xs text-white/30 mt-1">Exportados</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-white">{Object.keys(byAction).length}</p><p className="text-xs text-white/30 mt-1">Tipos de accion</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-white">{clips.filter((c) => !!c.video_analysis_id).length}</p><p className="text-xs text-white/30 mt-1">Con video fuente</p></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2"><Film className="w-3.5 h-3.5" /> Clips de {playerName}</p>
          <Link href={`/video-lab?player_id=${playerId}`} className="text-xs text-emerald-400 hover:underline">Abrir Video Lab</Link>
        </div>
        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-white/30"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : clips.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-white/30">
            <Search className="w-9 h-9 mb-3 opacity-30" />
            <p>No hay clips asociados a este jugador</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {clips.map((clip) => (
              <div key={clip.id} className="px-5 py-3 flex items-center gap-3">
                <button onClick={() => window.open(videoLabApi.clipFileUrl(clip.id), "_blank")} disabled={clip.status !== "ready"} className="theme-toggle" title="Reproducir clip"><Play className="w-3.5 h-3.5" /></button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/85 truncate">{clip.title}</p>
                  <p className="text-xs text-white/30">{clip.match_label || "sin partido"} · {clip.action_type || "clip"} · {timeLabel(clip.start_s)}-{timeLabel(clip.end_s)}</p>
                </div>
                <span className="badge bg-white/[0.03] border-white/[0.08] text-white/40">{clip.status}</span>
                <button onClick={() => exportClip.mutate(clip)} disabled={!clip.video_analysis_id || exportClip.isPending} className="btn-secondary text-xs px-3 py-1.5">
                  {exportClip.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Exportar
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}