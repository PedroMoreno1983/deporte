"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Film, Loader2, Play, Shield, UserRound } from "lucide-react";
import { videoLabApi } from "@/lib/api";

function timeLabel(seconds?: number | null) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function SharedVideoLabPlaylistPage() {
  const { token } = useParams<{ token: string }>();
  const { data: playlist, isLoading, error } = useQuery({
    queryKey: ["shared-video-lab", token],
    queryFn: () => videoLabApi.sharedPlaylist(token),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--paper)", color: "var(--ink)" }}>
        <Loader2 className="w-6 h-6 animate-spin" />
      </main>
    );
  }

  if (error || !playlist) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--paper)", color: "var(--ink)", padding: 24 }}>
        <section className="empty-state" style={{ maxWidth: 520 }}>
          <Shield className="w-8 h-8" />
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 28 }}>Playlist no disponible</h1>
          <p>El link pudo haber sido desactivado o no existe.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink)", padding: "32px 18px" }}>
      <section style={{ maxWidth: 1060, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap" }}>
          <div>
            <div className="chip is-on" style={{ marginBottom: 10 }}><Film className="w-3.5 h-3.5" /> Video Lab</div>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 38, lineHeight: 1.05, margin: 0 }}>{playlist.title}</h1>
            {playlist.description && <p style={{ marginTop: 8, color: "var(--ink-soft)", maxWidth: 680 }}>{playlist.description}</p>}
          </div>
          <div className="chip"><Shield className="w-3.5 h-3.5" /> Link privado</div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 18 }}>
          <div className="stat-card"><div className="stat-value">{playlist.clips.length}</div><div className="stat-label">Clips</div></div>
          <div className="stat-card"><div className="stat-value">{playlist.clips.filter((c) => c.status === "ready").length}</div><div className="stat-label">Listos</div></div>
          <div className="stat-card"><div className="stat-value">{new Set(playlist.clips.map((c) => c.player_id).filter(Boolean)).size}</div><div className="stat-label">Jugadores</div></div>
          <div className="stat-card"><div className="stat-value">{new Set(playlist.clips.map((c) => c.action_type || "Clip")).size}</div><div className="stat-label">Acciones</div></div>
        </div>

        <div className="inj-list">
          {playlist.clips.map((clip) => (
            <article className="inj-row" key={clip.id} style={{ alignItems: "center", gap: 12 }}>
              <button
                className="theme-toggle"
                disabled={clip.status !== "ready"}
                onClick={() => window.open(videoLabApi.sharedClipFileUrl(token, clip.id), "_blank")}
                title={clip.status === "ready" ? "Reproducir clip" : "Clip aun no exportado"}
              >
                <Play className="w-4 h-4" />
              </button>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="inj-player" style={{ cursor: "default" }}>{clip.title}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3 }}>
                  <span className="inj-region"><Calendar className="w-3 h-3 inline-block mr-1" /> {clip.match_label || "sin partido"}</span>
                  <span className="inj-region"><UserRound className="w-3 h-3 inline-block mr-1" /> {clip.player_name || "sin jugador"}</span>
                  <span className="inj-region">{timeLabel(clip.start_s)}-{timeLabel(clip.end_s)}</span>
                </div>
              </div>
              <span className="chip">{clip.action_type || "clip"}</span>
              <span className="chip" style={{ color: clip.status === "ready" ? "var(--pine)" : "var(--ink-soft)" }}>{clip.status}</span>
            </article>
          ))}
          {!playlist.clips.length && <div className="empty-state">Esta playlist todavia no tiene clips.</div>}
        </div>
      </section>
    </main>
  );
}
