"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Video, Users, Trophy, Activity,
  Gauge, MapPin, Image as ImageIcon, AlertTriangle, ChevronDown, Plus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PitchHeatmap, HeatPoint } from "@/components/tactical/PitchHeatmap";
import { cvApi, playersApi } from "@/lib/api";

/**
 * Backend's `results.json` is flexible — different runs of the pipeline
 * have used slightly different field names. We accept all of them here
 * and normalise on read.
 */
interface RawTrack {
  track_id: number;
  cls?: string;
  team?: string | number | null;
  team_color?: string | null;
  appearances?: number;
  // distance / speed: legacy + current field names
  total_distance_m?: number;
  distance_m?: number;
  max_speed_kmh?: number;
  avg_speed_kmh?: number;
  speed_kmh?: number;
  positions?: { frame: number; x: number; y: number }[];
}

interface Track {
  track_id: number;
  cls: string;
  team: "A" | "B" | null;
  team_color: string | null;
  appearances: number;
  total_distance_m: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  positions: { frame: number; x: number; y: number }[];
  jersey?: number | null;
}

interface CVResults {
  tracks: RawTrack[];
  team_colors?: { A?: string | null; B?: string | null } | null;
  sample?: string | null;
  output_video?: string | null;
  identities?: any[] | null;
}

function normaliseTeam(raw: string | number | null | undefined): "A" | "B" | null {
  if (raw == null) return null;
  if (raw === "A" || raw === 0 || raw === "0") return "A";
  if (raw === "B" || raw === 1 || raw === "1") return "B";
  return null;
}

function normaliseTrack(t: RawTrack): Track {
  const team = normaliseTeam(t.team);
  const total_distance_m = t.total_distance_m ?? t.distance_m ?? 0;
  const max_speed_kmh    = t.max_speed_kmh    ?? t.speed_kmh   ?? 0;
  const avg_speed_kmh    = t.avg_speed_kmh    ?? t.speed_kmh   ?? 0;
  return {
    track_id:        t.track_id,
    cls:             t.cls ?? "player",
    team,
    team_color:      t.team_color ?? null,
    appearances:     t.appearances ?? (t.positions?.length ?? 0),
    total_distance_m,
    max_speed_kmh,
    avg_speed_kmh,
    positions:       t.positions ?? [],
    jersey:          (t as any).jersey ?? null,
  };
}

interface CVRow {
  id: number;
  name: string;
  status: "pending" | "processing" | "done" | "failed";
  progress: number;
  duration_s: number | null;
  frame_count: number | null;
  fps: number | null;
  notes: string | null;
  results: CVResults | null;
  error: string | null;
}

export default function CVDetailPage({ params }: { params: { id: string } }) {
  const numId = Number(params.id);
  const [selectedTeam, setSelectedTeam] = useState<"both" | "A" | "B">("both");
  const [showAllTracks, setShowAllTracks] = useState(false);

  const { data, isLoading } = useQuery<CVRow>({
    queryKey: ["cv", numId],
    queryFn:  () => cvApi.get(numId),
    refetchInterval: 5_000,
  });

  const { data: players } = useQuery<any[]>({
    queryKey: ["players"],
    queryFn: () => playersApi.list({ limit: 500 }),
  });

  const jerseyToPlayerMap = useMemo(() => {
    const map = new Map<number, { first_name: string; last_name: string }>();
    if (players) {
      for (const p of players) {
        if (p.jersey_number != null) {
          map.set(Number(p.jersey_number), p);
        }
      }
    }
    return map;
  }, [players]);

  const getPlayerNameByJersey = (jersey: number | null | undefined) => {
    if (jersey == null) return null;
    const p = jerseyToPlayerMap.get(Number(jersey));
    return p ? `${p.first_name} ${p.last_name}` : null;
  };

  const tracks: Track[] = useMemo(
    () => (data?.results?.tracks ?? []).map(normaliseTrack),
    [data?.results?.tracks],
  );
  const teamColors = data?.results?.team_colors ?? { A: null, B: null };

  const playerTracks: Track[] = useMemo(() => {
    const idents = data?.results?.identities;
    if (idents && idents.length > 0) {
      return idents.map((id: any) => {
        const team = normaliseTeam(id.team);
        const teamColor = team === "A" ? (teamColors?.A ?? null) : team === "B" ? (teamColors?.B ?? null) : null;
        return {
          track_id: id.identity,
          cls: "player",
          team,
          team_color: teamColor,
          appearances: 100,
          total_distance_m: id.distance_m ?? 0,
          max_speed_kmh: id.top_speed_kmh ?? id.speed_kmh ?? 0,
          avg_speed_kmh: id.speed_kmh ?? 0,
          positions: [],
          jersey: id.jersey,
        };
      });
    }
    return tracks.filter((t) => (t.total_distance_m ?? 0) >= 5 || (t.max_speed_kmh ?? 0) >= 5);
  }, [data?.results?.identities, tracks, teamColors]);

  const heat = useMemo<{ A: HeatPoint[]; B: HeatPoint[] }>(() => {
    const a: HeatPoint[] = [];
    const b: HeatPoint[] = [];
    for (const t of tracks) {
      if (t.cls !== "player" && t.cls !== "goalkeeper") continue;
      const target = t.team === "A" ? a : t.team === "B" ? b : null;
      if (!target) continue;
      for (const p of t.positions ?? []) {
        target.push({ x: p.x, y: p.y, intensity: 0.6 });
      }
    }
    return { A: a, B: b };
  }, [tracks]);

  const realTracks = playerTracks;

  const visibleTracks = showAllTracks ? tracks : realTracks;

  const teams = useMemo(() => {
    const counts = { A: 0, B: 0, none: 0 };
    let topSpeed = 0;
    let totalDistance = 0;
    for (const t of realTracks) {
      if (t.team === "A") counts.A++;
      else if (t.team === "B") counts.B++;
      else counts.none++;
      if (t.max_speed_kmh > topSpeed) topSpeed = t.max_speed_kmh;
      totalDistance += t.total_distance_m;
    }
    return { counts, topSpeed, totalDistance };
  }, [realTracks]);

  // Per-team leaderboards (top 3 by distance / by peak speed)
  const leaderboards = useMemo(() => {
    const build = (team: "A" | "B") => {
      const list = realTracks.filter((t) => t.team === team);
      const byDistance = [...list].sort((a, b) => b.total_distance_m - a.total_distance_m).slice(0, 3);
      const bySpeed    = [...list].sort((a, b) => b.max_speed_kmh    - a.max_speed_kmh   ).slice(0, 3);
      return { byDistance, bySpeed };
    };
    return { A: build("A"), B: build("B") };
  }, [realTracks]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <PageHeader title="Cargando análisis..." icon={Video}
          iconColor="text-[#00ff87]"
          iconBg="bg-[rgba(0,255,135,0.10)] border-[rgba(0,255,135,0.30)]" />
        <Card>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl">
        <EmptyState
          illustration="data"
          title="Análisis no encontrado"
          description="El análisis pudo haber sido eliminado o no tienes acceso."
        />
        <div className="text-center mt-4">
          <Link href="/cv" className="btn-secondary text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </Link>
        </div>
      </div>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="max-w-6xl space-y-4">
        <Link href="/cv" className="btn-secondary text-xs inline-flex w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver
        </Link>
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5" style={{ color: "var(--color-danger)" }} />
            <div>
              <p className="text-sm font-bold text-white">El procesamiento falló</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
                {data.error ?? "Error desconocido"}
              </p>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                Si esto persiste, revisa que las dependencias del módulo CV estén instaladas
                (<code>ultralytics</code>, <code>opencv-python-headless</code>, <code>supervision</code>) y
                que haya un checkpoint YOLO disponible.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const isReady = data.status === "done";
  const sampleUrl = isReady && data.results?.sample ? cvApi.sampleUrl(data.id) : null;
  const outputVideoUrl = isReady && data.results?.output_video ? cvApi.outputVideoUrl(data.id) : null;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/cv" className="btn-secondary text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Lista
        </Link>
        <PageHeader
          title={data.name}
          description={data.notes ?? "Análisis de video"}
          icon={Video}
          iconColor="text-[#00ff87]"
          iconBg="bg-[rgba(0,255,135,0.10)] border-[rgba(0,255,135,0.30)]"
        />
      </div>

      {!isReady ? (
        <Card>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 animate-pulse" style={{ color: "#0ea5e9" }} />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Procesando...</p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.progress ?? 0) * 100}%` }}
                  transition={{ duration: 0.4 }}
                  style={{ background: "#0ea5e9", boxShadow: "0 0 6px rgba(14,165,233,0.5)" }}
                />
              </div>
              <p className="text-[11px] mt-1.5 font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                {Math.round((data.progress ?? 0) * 100)}%
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="w-4 h-4" style={{ color: "#00ff87" }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Jugadores</p>
              </div>
              <p className="text-2xl font-mono font-black tabular-nums text-white">
                {teams.counts.A + teams.counts.B + teams.counts.none}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                <span style={{ color: teamColors?.A ?? "#00ff87" }}>● A: {teams.counts.A}</span>{" "}
                <span style={{ color: teamColors?.B ?? "#0ea5e9" }}>● B: {teams.counts.B}</span>
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Gauge className="w-4 h-4" style={{ color: "#f59e0b" }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Pico velocidad</p>
              </div>
              <p className="text-2xl font-mono font-black tabular-nums text-white">
                {teams.topSpeed.toFixed(1)}
                <span className="text-sm text-white/40 ml-1">km/h</span>
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Activity className="w-4 h-4" style={{ color: "#0ea5e9" }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Distancia total</p>
              </div>
              <p className="text-2xl font-mono font-black tabular-nums text-white">
                {(teams.totalDistance / 1000).toFixed(2)}
                <span className="text-sm text-white/40 ml-1">km</span>
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Trophy className="w-4 h-4" style={{ color: "#a855f7" }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Duración</p>
              </div>
              <p className="text-2xl font-mono font-black tabular-nums text-white">
                {data.duration_s != null ? `${Math.floor(data.duration_s / 60)}:${String(Math.floor(data.duration_s % 60)).padStart(2, "0")}` : "—"}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {data.frame_count?.toLocaleString() ?? "—"} frames @ {data.fps?.toFixed(1) ?? "—"} fps
              </p>
            </Card>
          </div>

          {/* Mapear dorsales importando Excel */}
          <Card className="border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-3">
              <Users className="w-5 h-5 text-[#00ff87] shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">¿Faltan nombres de jugadores?</h4>
                <p className="text-xs text-white/60 mt-0.5">
                  Mapea los números de camiseta a los jugadores importando el Excel del plantel.
                </p>
              </div>
            </div>
            <Link href="/players" className="btn-primary text-xs shrink-0 inline-flex items-center gap-1.5 self-start sm:self-auto">
              <Plus className="w-3.5 h-3.5" />
              Importar Excel/CSV
            </Link>
          </Card>

          {/* Sample frame */}
          {sampleUrl && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="w-4 h-4" style={{ color: "#00ff87" }} />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  Frame anotado
                </p>
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sampleUrl}
                  alt="Frame anotado del análisis"
                  className="w-full h-auto block"
                  style={{ background: "var(--surface-1)" }}
                />
              </div>
            </Card>
          )}

          {/* Annotated output video */}
          {outputVideoUrl && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Video className="w-4 h-4" style={{ color: "#00ff87" }} />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  Video anotado completo
                </p>
              </div>
              <video
                controls
                preload="metadata"
                src={outputVideoUrl}
                className="w-full rounded-lg block"
                style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,0.06)" }}
              />
            </Card>
          )}
          {/* Heatmap by team */}
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: "#0ea5e9" }} />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  Mapa de calor por equipo
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(["both", "A", "B"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedTeam(opt)}
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-all"
                    style={{
                      background: selectedTeam === opt ? "rgba(0,255,135,0.15)" : "rgba(255,255,255,0.04)",
                      color: selectedTeam === opt ? "#00ff87" : "rgba(255,255,255,0.45)",
                      border: `1px solid ${selectedTeam === opt ? "rgba(0,255,135,0.40)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {opt === "both" ? "Ambos" : `Equipo ${opt}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-6 justify-center">
              {(selectedTeam === "A" || selectedTeam === "both") && (
                <div>
                  <p
                    className="text-xs font-bold mb-2 text-center"
                    style={{ color: teamColors?.A ?? "#00ff87" }}
                  >
                    ● Equipo A · {heat.A.length} muestras
                  </p>
                  <PitchHeatmap points={heat.A} width={360} />
                </div>
              )}
              {(selectedTeam === "B" || selectedTeam === "both") && (
                <div>
                  <p
                    className="text-xs font-bold mb-2 text-center"
                    style={{ color: teamColors?.B ?? "#0ea5e9" }}
                  >
                    ● Equipo B · {heat.B.length} muestras
                  </p>
                  <PitchHeatmap points={heat.B} width={360} />
                </div>
              )}
            </div>
          </Card>

          {/* ── Leaderboards by team ───────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(["A", "B"] as const).map((teamCode) => {
              const teamColor = teamColors?.[teamCode] ?? (teamCode === "A" ? "#00ff87" : "#0ea5e9");
              const lb = leaderboards[teamCode];
              return (
                <Card key={teamCode} className="relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${teamColor}, transparent)` }}
                  />
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ background: teamColor, boxShadow: `0 0 8px ${teamColor}` }}
                    />
                    <p className="text-sm font-bold text-white">Equipo {teamCode}</p>
                    <span className="text-[10px] font-mono tabular-nums ml-auto" style={{ color: "var(--text-muted)" }}>
                      {teams.counts[teamCode]} jugadores
                    </span>
                  </div>

                  {/* By distance */}
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--text-muted)" }}>
                    Top distancia recorrida
                  </p>
                  {lb.byDistance.length === 0 ? (
                    <p className="text-xs py-3" style={{ color: "var(--text-muted)" }}>Sin datos suficientes</p>
                  ) : (
                    <div className="space-y-1.5 mb-5">
                      {lb.byDistance.map((t, i) => {
                        const max = lb.byDistance[0]?.total_distance_m || 1;
                        const pct = (t.total_distance_m / max) * 100;
                        return (
                          <div key={t.track_id} className="flex items-center gap-3">
                            <span
                              className="text-[10px] font-mono w-4 text-right shrink-0"
                              style={{ color: i === 0 ? teamColor : "var(--text-muted)" }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-[11px] font-medium text-white/70 w-28 shrink-0 truncate text-left" title={getPlayerNameByJersey(t.jersey) || (t.jersey != null ? `Dorsal ${t.jersey}` : `#${t.track_id}`)}>
                              {getPlayerNameByJersey(t.jersey) || (t.jersey != null ? `Dorsal ${t.jersey}` : `#${t.track_id}`)}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                                className="h-full"
                                style={{ background: teamColor, boxShadow: i === 0 ? `0 0 6px ${teamColor}` : undefined }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold tabular-nums w-14 text-right shrink-0 text-white/85">
                              {t.total_distance_m.toFixed(1)} m
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* By peak speed */}
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--text-muted)" }}>
                    Top velocidad pico
                  </p>
                  {lb.bySpeed.length === 0 ? (
                    <p className="text-xs py-3" style={{ color: "var(--text-muted)" }}>Sin datos suficientes</p>
                  ) : (
                    <div className="space-y-1.5">
                      {lb.bySpeed.map((t, i) => {
                        const max = lb.bySpeed[0]?.max_speed_kmh || 1;
                        const pct = (t.max_speed_kmh / max) * 100;
                        return (
                          <div key={t.track_id} className="flex items-center gap-3">
                            <span
                              className="text-[10px] font-mono w-4 text-right shrink-0"
                              style={{ color: i === 0 ? teamColor : "var(--text-muted)" }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-[11px] font-medium text-white/70 w-28 shrink-0 truncate text-left" title={getPlayerNameByJersey(t.jersey) || (t.jersey != null ? `Dorsal ${t.jersey}` : `#${t.track_id}`)}>
                              {getPlayerNameByJersey(t.jersey) || (t.jersey != null ? `Dorsal ${t.jersey}` : `#${t.track_id}`)}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                                className="h-full"
                                style={{ background: teamColor, boxShadow: i === 0 ? `0 0 6px ${teamColor}` : undefined }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold tabular-nums w-16 text-right shrink-0 text-white/85">
                              {t.max_speed_kmh.toFixed(1)} km/h
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* ── Raw tracks table (collapsed by default) ─────────── */}
          <Card padding="none" className="overflow-hidden">
            <button
              onClick={() => setShowAllTracks((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between transition-colors hover:bg-white/[0.02]"
            >
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  Datos crudos por track
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {showAllTracks ? "Click para ocultar" : "Click para expandir"} · {realTracks.length} tracks reales · {tracks.length - realTracks.length} ruido descartado
                </p>
              </div>
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{
                  color: "var(--text-muted)",
                  transform: showAllTracks ? "rotate(180deg)" : "none",
                }}
              />
            </button>
            <AnimatePresence initial={false}>
              {showAllTracks && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <div className="overflow-x-auto" style={{ maxHeight: 320 }}>
                    <table className="w-full text-sm">
                      <thead style={{ background: "var(--surface-1)" }} className="sticky top-0">
                        <tr className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          <th className="px-5 py-2 text-left">Track</th>
                          <th className="px-5 py-2 text-left">Dorsal</th>
                          <th className="px-5 py-2 text-left">Jugador</th>
                          <th className="px-5 py-2 text-left">Equipo</th>
                          <th className="px-5 py-2 text-right">Dist. (m)</th>
                          <th className="px-5 py-2 text-right">V. promedio</th>
                          <th className="px-5 py-2 text-right">V. máxima</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realTracks.map((t) => (
                          <tr key={t.track_id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                            <td className="px-5 py-2 font-mono text-white/60">#{t.track_id}</td>
                            <td className="px-5 py-2 font-mono text-white/70">{t.jersey != null ? `#${t.jersey}` : <span className="text-white/20">—</span>}</td>
                            <td className="px-5 py-2 text-white/95">{getPlayerNameByJersey(t.jersey) || <span className="text-white/25 text-xs">No asignado</span>}</td>
                            <td className="px-5 py-2">
                              {t.team ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: t.team_color ?? (t.team === "A" ? "#00ff87" : "#0ea5e9") }}
                                  />
                                  <span className="font-bold text-xs" style={{ color: t.team_color ?? "rgba(255,255,255,0.7)" }}>
                                    {t.team}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-white/25 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-5 py-2 text-right font-mono tabular-nums text-white/80">{t.total_distance_m.toFixed(1)}</td>
                            <td className="px-5 py-2 text-right font-mono tabular-nums text-white/70">{t.avg_speed_kmh.toFixed(1)}</td>
                            <td
                              className="px-5 py-2 text-right font-mono tabular-nums font-bold"
                              style={{ color: t.max_speed_kmh > 25 ? "#00ff87" : "rgba(255,255,255,0.7)" }}
                            >
                              {t.max_speed_kmh.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </>
      )}
    </div>
  );
}
