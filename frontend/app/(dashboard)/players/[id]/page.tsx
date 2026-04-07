"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { playersApi, analyticsApi, predictionsApi, kinesiologyApi, injuriesApi, wellnessApi } from "@/lib/api";
import { POSITION_LABELS, formatAge } from "@/lib/utils";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { GlowCard } from "@/components/ui/GlowCard";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import {
  Activity, AlertTriangle, Shield, TrendingUp, Dumbbell,
  Calendar, ArrowLeft, TrendingDown, Minus, Brain, Heart, Moon, Zap, Droplets
} from "lucide-react";
import Link from "next/link";

const POSITION_GROUPS: Record<string, "gk" | "def" | "mid" | "atk"> = {
  goalkeeper: "gk", center_back: "def", left_back: "def", right_back: "def",
  defensive_mid: "mid", central_mid: "mid", attacking_mid: "mid",
  left_wing: "atk", right_wing: "atk", center_forward: "atk",
};
const POS_COLOR = { gk: "#f59e0b", def: "#0ea5e9", mid: "#00ff87", atk: "#ff3b30" };
const POS_BG = { gk: "rgba(245,158,11,0.12)", def: "rgba(14,165,233,0.12)", mid: "rgba(0,255,135,0.10)", atk: "rgba(255,59,48,0.12)" };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:  { label: "Disponible",   color: "#00ff87", bg: "rgba(0,255,135,0.12)" },
  injured:    { label: "Lesionado",    color: "#ff3b30", bg: "rgba(255,59,48,0.12)" },
  recovering: { label: "Recuperación", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  suspended:  { label: "Suspendido",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  inactive:   { label: "Inactivo",     color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

const RISK_COLOR: Record<string, string> = {
  low: "#00ff87", medium: "#f59e0b", high: "#f97316", critical: "#ff3b30",
};
const RISK_LABEL: Record<string, string> = {
  low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico",
};

const TABS = ["Resumen", "Físico", "Rendimiento", "Lesiones", "Wellness", "Predicción"] as const;
type Tab = typeof TABS[number];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border-medium)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="font-bold" style={{ color: "var(--neon)" }}>{payload[0]?.value?.toFixed(1)}</p>
    </div>
  );
};

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const playerId = Number(id);
  const [tab, setTab] = useState<Tab>("Resumen");

  const { data: player } = useQuery({ queryKey: ["player", playerId], queryFn: () => playersApi.get(playerId) });
  const { data: summary } = useQuery({ queryKey: ["player-summary", playerId], queryFn: () => analyticsApi.playerSummary(playerId) });
  const { data: prediction } = useQuery({ queryKey: ["prediction", playerId], queryFn: () => predictionsApi.getForPlayer(playerId) });
  const { data: kinesiology } = useQuery({ queryKey: ["kinesiology", playerId], queryFn: () => kinesiologyApi.getByPlayer(playerId) });
  const { data: injuries } = useQuery({ queryKey: ["injuries-player", playerId], queryFn: () => injuriesApi.getByPlayer(playerId) });
  const [wellnessDays, setWellnessDays] = useState(30);
  const { data: wellnessHistory } = useQuery({ queryKey: ["wellness-player", playerId, wellnessDays], queryFn: () => wellnessApi.getByPlayer(playerId, wellnessDays) });
  const { data: playerRadar } = useQuery({ queryKey: ["player-radar", playerId], queryFn: () => analyticsApi.playerRadar(playerId) });

  if (!player) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <Activity className="w-8 h-8 animate-pulse" style={{ color: "var(--neon)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando jugador...</p>
      </div>
    </div>
  );

  const group = POSITION_GROUPS[player.position] ?? "mid";
  const posColor = POS_COLOR[group];
  const posBg = POS_BG[group];
  const statusCfg = STATUS_CONFIG[player.status] ?? STATUS_CONFIG.inactive;
  const latestKinesio = kinesiology?.[0];
  const activeInjuries = injuries?.filter((inj: { is_recovered: boolean }) => !inj.is_recovered) ?? [];
  const allInjuries = injuries ?? [];

  const radarData = latestKinesio ? [
    { metric: "Fuerza",    value: latestKinesio.squat_1rm_kg ? Math.min((latestKinesio.squat_1rm_kg / 150) * 100, 100) : 0 },
    { metric: "Velocidad", value: latestKinesio.sprint_30m_sec ? Math.max(100 - (latestKinesio.sprint_30m_sec - 3.5) * 50, 0) : 0 },
    { metric: "Salto",     value: latestKinesio.cmj_height_cm ? Math.min((latestKinesio.cmj_height_cm / 60) * 100, 100) : 0 },
    { metric: "VO₂ Máx",  value: latestKinesio.vo2_max ? Math.min((latestKinesio.vo2_max / 65) * 100, 100) : 0 },
    { metric: "Flexibil.", value: latestKinesio.sit_and_reach_cm ? Math.min(((latestKinesio.sit_and_reach_cm + 20) / 60) * 100, 100) : 0 },
  ] : [];

  const forecastData = prediction?.performance_forecast_4w?.map((v: number, i: number) => ({
    week: `Sem ${i + 1}`, value: v
  })) ?? [];

  const TrendIcon = prediction?.performance_trend === "improving" ? TrendingUp :
    prediction?.performance_trend === "declining" ? TrendingDown : Minus;
  const trendColor = prediction?.performance_trend === "improving" ? "#00ff87" :
    prediction?.performance_trend === "declining" ? "#ff3b30" : "#f59e0b";

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Hero header band ──────────────────────────── */}
      <div
        className="relative px-6 pt-6 pb-24 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${posBg} 0%, rgba(10,15,30,0.98) 60%)`,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {/* Position watermark */}
        <div
          className="absolute -right-8 -top-8 font-black select-none pointer-events-none"
          style={{
            fontSize: 200, lineHeight: 1,
            color: posColor, opacity: 0.04,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {player.jersey_number ?? "?"}
        </div>

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs mb-6 transition-colors pl-10 lg:pl-0"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a jugadores
        </button>

        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0"
            style={{
              background: "rgba(10,15,30,0.7)",
              border: `2px solid ${posColor}`,
              color: posColor,
              boxShadow: `0 0 24px ${posBg}, 0 0 0 4px rgba(10,15,30,0.5)`,
            }}
          >
            {player.photo_url ? (
              <img src={player.photo_url} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : `${player.first_name.charAt(0)}${player.last_name.charAt(0)}`}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              {player.jersey_number && (
                <span className="text-sm font-mono font-bold" style={{ color: posColor, opacity: 0.7 }}>
                  #{player.jersey_number}
                </span>
              )}
              <h1 className="text-3xl font-black tracking-tight text-white">
                {player.first_name} {player.last_name}
              </h1>
              <span
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ color: statusCfg.color, background: statusCfg.bg }}
              >
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {POSITION_LABELS[player.position] ?? player.position}
              {player.category && <> · <span style={{ color: posColor }}>{player.category.name}</span></>}
              {player.date_of_birth && <> · {formatAge(player.date_of_birth)} años</>}
            </p>
            {player.dominant_foot && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Pie dominante: {player.dominant_foot === "right" ? "Derecho" : player.dominant_foot === "left" ? "Izquierdo" : "Ambidextro"}
              </p>
            )}
          </div>

          {/* Risk gauge */}
          {prediction && (
            <div className="shrink-0">
              <RiskGauge score={prediction.injury_risk_score} level={prediction.injury_risk_level} size={120} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="absolute bottom-0 left-6 right-6 flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-150 relative"
              style={tab === t ? {
                color: posColor,
                background: "var(--surface-1)",
                borderTop: `2px solid ${posColor}`,
              } : {
                color: "var(--text-muted)",
                background: "transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────── */}
      <div className="p-6 space-y-5">

        {/* ── RESUMEN ──────────────────────────────────── */}
        {tab === "Resumen" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { icon: Calendar,     label: "Partidos",       value: summary?.matches ?? 0,                        color: "#0ea5e9" },
                { icon: TrendingUp,   label: "Goles + Asist.", value: summary?.goal_contributions ?? 0,             color: "#00ff87" },
                { icon: Activity,     label: "Rating prom.",   value: summary?.avg_rating?.toFixed(1) ?? "—",       color: "#f59e0b", raw: true },
                { icon: Dumbbell,     label: "Carga semanal",  value: summary?.weekly_load ?? 0,                    color: "#a855f7" },
                { icon: AlertTriangle,label: "Lesiones",       value: summary?.total_injuries ?? 0,                 color: "#ff3b30" },
              ].map(({ icon: Icon, label, value, color, raw }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <GlowCard className="p-4 rounded-xl text-center">
                    <div className="flex justify-center mb-2">
                      <div className="p-1.5 rounded-lg" style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                    </div>
                    {raw ? (
                      <div className="text-2xl font-black">{value}</div>
                    ) : (
                      <AnimatedCounter value={Number(value)} className="text-2xl font-black" />
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                  </GlowCard>
                </motion.div>
              ))}
            </div>

            {/* Active injuries alert */}
            {activeInjuries.length > 0 && (
              <GlowCard className="p-5 rounded-2xl" style={{ border: "1px solid rgba(255,59,48,0.25)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg" style={{ background: "rgba(255,59,48,0.1)" }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: "var(--danger)" }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: "var(--danger)" }}>
                    Lesiones activas — {activeInjuries.length} en curso
                  </h3>
                </div>
                <div className="space-y-2">
                  {activeInjuries.map((inj: { id: number; injury_type: string; body_zone: string; severity: string; injury_date: string; estimated_days_out?: number }) => (
                    <div key={inj.id} className="flex items-center justify-between text-sm rounded-xl px-4 py-2.5"
                      style={{ background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.12)" }}>
                      <div>
                        <span className="font-semibold text-white/80">{inj.injury_type}</span>
                        <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                          · {inj.body_zone.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-right text-xs" style={{ color: "var(--text-muted)" }}>
                        {inj.injury_date}
                        {inj.estimated_days_out && <span className="ml-2 font-semibold" style={{ color: "#ff3b30" }}>{inj.estimated_days_out}d est.</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            )}

            {/* Radar + Forecast preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {radarData.length > 0 && (
                <GlowCard className="p-5 rounded-2xl">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                    Perfil físico
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <Radar dataKey="value" stroke={posColor} fill={posColor} fillOpacity={0.15} strokeWidth={2}
                        dot={{ fill: posColor, r: 3, strokeWidth: 0 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </GlowCard>
              )}

              {forecastData.length > 0 && (
                <GlowCard className="p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Proyección 4 semanas
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: trendColor, background: `${trendColor}15` }}>
                      <TrendIcon className="w-3 h-3" />
                      {prediction?.performance_trend === "improving" ? "Mejorando" :
                       prediction?.performance_trend === "declining" ? "Bajando" : "Estable"}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="value" stroke={posColor} strokeWidth={2}
                        dot={{ fill: posColor, r: 3, strokeWidth: 0 }} strokeDasharray="6 3" />
                    </LineChart>
                  </ResponsiveContainer>
                  {prediction?.performance_confidence && (
                    <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                      Confianza: <span className="font-semibold" style={{ color: posColor }}>
                        {(prediction.performance_confidence * 100).toFixed(0)}%
                      </span>
                    </p>
                  )}
                </GlowCard>
              )}
            </div>
          </motion.div>
        )}

        {/* ── FÍSICO ──────────────────────────────────── */}
        {tab === "Físico" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {latestKinesio ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Squat 1RM", value: latestKinesio.squat_1rm_kg ? `${latestKinesio.squat_1rm_kg} kg` : "—" },
                    { label: "Sprint 30m", value: latestKinesio.sprint_30m_sec ? `${latestKinesio.sprint_30m_sec}s` : "—" },
                    { label: "CMJ Height", value: latestKinesio.cmj_height_cm ? `${latestKinesio.cmj_height_cm} cm` : "—" },
                    { label: "VO₂ Máx", value: latestKinesio.vo2_max ? `${latestKinesio.vo2_max}` : "—" },
                    { label: "Sit & Reach", value: latestKinesio.sit_and_reach_cm ? `${latestKinesio.sit_and_reach_cm} cm` : "—" },
                    { label: "% Grasa corporal", value: latestKinesio.body_fat_percentage ? `${latestKinesio.body_fat_percentage}%` : "—" },
                    { label: "Masa muscular", value: latestKinesio.muscle_mass_kg ? `${latestKinesio.muscle_mass_kg} kg` : "—" },
                    { label: "Peso", value: latestKinesio.weight_kg ? `${latestKinesio.weight_kg} kg` : "—" },
                  ].map(({ label, value }) => (
                    <GlowCard key={label} className="p-4 rounded-xl">
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-xl font-black" style={{ color: posColor }}>{value}</p>
                    </GlowCard>
                  ))}
                </div>

                {radarData.length > 0 && (
                  <GlowCard className="p-5 rounded-2xl">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                      Radar de capacidades
                    </p>
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.06)" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                        <Radar dataKey="value" stroke={posColor} fill={posColor} fillOpacity={0.15} strokeWidth={2.5}
                          dot={{ fill: posColor, r: 4, strokeWidth: 0 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                    {latestKinesio.assessment_date && (
                      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                        Evaluación: {latestKinesio.assessment_date}
                      </p>
                    )}
                  </GlowCard>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
                <Dumbbell className="w-10 h-10 mb-3 opacity-30" />
                <p>Sin registros kinesiológicos disponibles</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── RENDIMIENTO ─────────────────────────────── */}
        {tab === "Rendimiento" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Partidos jugados", value: summary?.matches ?? 0, color: "#0ea5e9" },
                { label: "Goles",            value: summary?.goals ?? 0,   color: "#00ff87" },
                { label: "Asistencias",      value: summary?.assists ?? 0, color: "#f59e0b" },
                { label: "Rating promedio",  value: summary?.avg_rating?.toFixed(1) ?? "—", color: posColor, raw: true },
              ].map(({ label, value, color, raw }: any) => (
                <GlowCard key={label} className="p-5 rounded-xl text-center">
                  {raw ? (
                    <p className="text-3xl font-black mb-1" style={{ color }}>{value}</p>
                  ) : (
                    <AnimatedCounter value={Number(value)} className="text-3xl font-black mb-1" style={{ color } as any} />
                  )}
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                </GlowCard>
              ))}
            </div>

            {/* Performance radar vs team avg */}
            {playerRadar && (
              <GlowCard className="p-5 rounded-2xl">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                  Radar vs promedio equipo
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                  Métricas normalizadas 0-100
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={[
                      { metric: "Rendimiento", jugador: playerRadar.player?.rendimiento ?? 0, equipo: playerRadar.team_avg?.rendimiento ?? 0 },
                      { metric: "Goles",       jugador: playerRadar.player?.goles ?? 0,       equipo: playerRadar.team_avg?.goles ?? 0 },
                      { metric: "Asistencias", jugador: playerRadar.player?.asistencias ?? 0, equipo: playerRadar.team_avg?.asistencias ?? 0 },
                      { metric: "Minutos",     jugador: playerRadar.player?.minutos ?? 0,     equipo: playerRadar.team_avg?.minutos ?? 0 },
                      { metric: "Carga",       jugador: playerRadar.player?.carga ?? 0,       equipo: playerRadar.team_avg?.carga ?? 0 },
                    ]}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <Radar name="Jugador" dataKey="jugador" stroke={posColor} fill={posColor} fillOpacity={0.2} strokeWidth={2}
                        dot={{ fill: posColor, r: 3, strokeWidth: 0 }} />
                      <Radar name="Equipo" dataKey="equipo" stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.04)" strokeWidth={1.5} strokeDasharray="4 2" />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 self-center">
                    {["rendimiento","goles","asistencias","minutos","carga"].map((key) => {
                      const val = playerRadar.player?.[key] ?? 0;
                      const avg = playerRadar.team_avg?.[key] ?? 0;
                      const above = val >= avg;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="capitalize" style={{ color: "var(--text-secondary)" }}>{key}</span>
                            <span className="font-bold" style={{ color: above ? "var(--neon)" : "#f97316" }}>
                              {val.toFixed(0)} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/ prom {avg.toFixed(0)}</span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${val}%` }}
                              transition={{ duration: 0.7, delay: 0.2 }}
                              className="h-full rounded-full"
                              style={{ background: above ? "var(--neon)" : "#f97316" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 rounded" style={{ background: posColor }} />
                        Jugador
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 rounded" style={{ background: "rgba(255,255,255,0.3)" }} />
                        Promedio
                      </div>
                    </div>
                  </div>
                </div>
              </GlowCard>
            )}

            {forecastData.length > 0 && (
              <GlowCard className="p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Proyección de rendimiento (4 semanas)
                  </p>
                  <div className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                    style={{ color: trendColor, background: `${trendColor}15` }}>
                    <TrendIcon className="w-3 h-3" />
                    {prediction?.performance_trend === "improving" ? "Mejorando" :
                     prediction?.performance_trend === "declining" ? "Bajando" : "Estable"}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke={posColor} strokeWidth={2.5}
                      dot={{ fill: posColor, r: 4, strokeWidth: 0 }} strokeDasharray="6 3" />
                  </LineChart>
                </ResponsiveContainer>
              </GlowCard>
            )}
          </motion.div>
        )}

        {/* ── LESIONES ──────────────────────────────── */}
        {tab === "Lesiones" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {allInjuries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
                <Shield className="w-10 h-10 mb-3 opacity-30" style={{ color: "#00ff87" }} />
                <p>Sin historial de lesiones</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allInjuries.map((inj: {
                  id: number; injury_type: string; body_zone: string; severity: string;
                  injury_date: string; estimated_days_out?: number; return_date?: string;
                  is_recovered: boolean; treatment?: string; mechanism?: string;
                }, i: number) => {
                  const sevColors: Record<string, string> = {
                    grade_1: "#00ff87", grade_2: "#f59e0b", grade_3: "#f97316", grade_4: "#ff3b30"
                  };
                  const sevLabels: Record<string, string> = {
                    grade_1: "Grado I", grade_2: "Grado II", grade_3: "Grado III", grade_4: "Grado IV"
                  };
                  const color = sevColors[inj.severity] ?? "#64748b";
                  const isActive = !inj.is_recovered;
                  return (
                    <motion.div
                      key={inj.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-start gap-4 p-4 rounded-2xl"
                      style={{
                        background: isActive ? "rgba(255,59,48,0.05)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isActive ? "rgba(255,59,48,0.2)" : "var(--border-subtle)"}`,
                      }}
                    >
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: isActive ? "#ff3b30" : "#475569" }} />
                        {i < allInjuries.length - 1 && (
                          <div className="w-px flex-1 min-h-4" style={{ background: "var(--border-subtle)" }} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-white/90">{inj.injury_type}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ color, background: `${color}15` }}>
                            {sevLabels[inj.severity]}
                          </span>
                          {isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ color: "#ff3b30", background: "rgba(255,59,48,0.12)" }}>
                              Activa
                            </span>
                          )}
                        </div>
                        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                          {inj.body_zone.replace(/_/g, " ")} · {inj.injury_date}
                          {inj.estimated_days_out && ` · ${inj.estimated_days_out} días estimados`}
                          {inj.return_date && ` · Alta: ${inj.return_date}`}
                        </p>
                        {inj.treatment && (
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{inj.treatment}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── WELLNESS ─────────────────────────────────── */}
        {tab === "Wellness" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Days selector */}
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Período:</p>
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setWellnessDays(d)}
                  className="px-3 py-1 text-xs font-semibold rounded-lg transition-all"
                  style={wellnessDays === d ? {
                    background: `${posColor}20`,
                    border: `1px solid ${posColor}50`,
                    color: posColor,
                  } : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>

            {(!wellnessHistory || wellnessHistory.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
                <Heart className="w-10 h-10 mb-3 opacity-30" style={{ color: posColor }} />
                <p>Sin registros de wellness disponibles</p>
              </div>
            ) : (
              <>
                {/* Score evolution chart */}
                <GlowCard className="p-5 rounded-2xl">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                    Evolución wellness — últimos {wellnessDays} días
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={[...wellnessHistory].reverse().map((w: any) => ({
                      fecha: w.date?.slice(5) ?? w.created_at?.slice(5, 10) ?? "",
                      score: w.overall_score ?? Math.round(
                        ((w.sleep_quality ?? 5) + (w.energy_level ?? 5) + (w.mood ?? 5) +
                         (10 - (w.stress_level ?? 5)) + (w.hydration ?? 5) +
                         (10 - (w.muscle_soreness ?? 5))) / 6 * 10
                      ),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="fecha" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="score" stroke={posColor} strokeWidth={2.5}
                        dot={{ fill: posColor, r: 3, strokeWidth: 0 }}
                        style={{ filter: `drop-shadow(0 0 6px ${posColor}60)` }} />
                    </LineChart>
                  </ResponsiveContainer>
                </GlowCard>

                {/* Last entry breakdown */}
                {(() => {
                  const last = wellnessHistory[0];
                  if (!last) return null;
                  const metrics = [
                    { label: "Calidad de sueño", value: last.sleep_quality, icon: Moon, invert: false },
                    { label: "Nivel de energía",  value: last.energy_level,  icon: Zap,  invert: false },
                    { label: "Estado de ánimo",   value: last.mood,           icon: Heart, invert: false },
                    { label: "Estrés",            value: last.stress_level,  icon: Activity, invert: true },
                    { label: "Hidratación",       value: last.hydration,     icon: Droplets, invert: false },
                    { label: "Dolor muscular",    value: last.muscle_soreness, icon: Dumbbell, invert: true },
                  ].filter(m => m.value != null);
                  return (
                    <GlowCard className="p-5 rounded-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                          Último registro
                        </p>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {last.date ?? last.created_at?.slice(0, 10)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {metrics.map(({ label, value, icon: Icon, invert }) => {
                          const pct = (value / 10) * 100;
                          const normalized = invert ? 100 - pct : pct;
                          const color = normalized >= 70 ? "var(--neon)" : normalized >= 40 ? "#f59e0b" : "#ff3b30";
                          return (
                            <div key={label}>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <div className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                                  <Icon className="w-3.5 h-3.5" />
                                  {label}
                                </div>
                                <span className="font-bold" style={{ color }}>{value}/10</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.6, delay: 0.1 }}
                                  className="h-full rounded-full"
                                  style={{ background: color }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {last.notes && (
                        <p className="mt-4 text-xs p-3 rounded-xl" style={{ color: "var(--text-secondary)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
                          {last.notes}
                        </p>
                      )}
                    </GlowCard>
                  );
                })()}

                {/* Recent entries mini list */}
                <GlowCard className="rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Historial de registros
                    </p>
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                    {wellnessHistory.slice(0, 10).map((w: any, i: number) => {
                      const score = w.overall_score ?? Math.round(
                        ((w.sleep_quality ?? 5) + (w.energy_level ?? 5) + (w.mood ?? 5) +
                         (10 - (w.stress_level ?? 5)) + (w.hydration ?? 5) +
                         (10 - (w.muscle_soreness ?? 5))) / 6 * 10
                      );
                      const color = score >= 70 ? "var(--neon)" : score >= 50 ? "#f59e0b" : "#ff3b30";
                      return (
                        <motion.div
                          key={w.id ?? i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center justify-between px-5 py-3"
                        >
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {w.date ?? w.created_at?.slice(0, 10)}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
                            </div>
                            <span className="text-xs font-bold w-8 text-right" style={{ color }}>{score}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </GlowCard>
              </>
            )}
          </motion.div>
        )}

        {/* ── PREDICCIÓN ──────────────────────────────── */}
        {tab === "Predicción" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {prediction ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Risk gauge large */}
                  <GlowCard className="p-6 rounded-2xl flex flex-col items-center gap-4">
                    <p className="text-xs font-semibold uppercase tracking-widest self-start" style={{ color: "var(--text-muted)" }}>
                      Riesgo de lesión
                    </p>
                    <RiskGauge score={prediction.injury_risk_score} level={prediction.injury_risk_level} size={180} />
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: RISK_COLOR[prediction.injury_risk_level] }}>
                        Riesgo {RISK_LABEL[prediction.injury_risk_level]}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Actualizado: {prediction.calculated_at?.slice(0, 10)}
                      </p>
                    </div>
                  </GlowCard>

                  {/* Risk factors */}
                  <GlowCard className="p-5 rounded-2xl">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                      Factores de riesgo
                    </p>
                    {prediction.risk_factors && Object.entries(prediction.risk_factors).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(prediction.risk_factors).map(([key, value]: [string, any]) => (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1">
                              <span style={{ color: "var(--text-secondary)" }}>{key.replace(/_/g, " ")}</span>
                              <span className="font-bold" style={{ color: "var(--neon)" }}>{typeof value === "number" ? value.toFixed(0) : String(value)}</span>
                            </div>
                            {typeof value === "number" && (
                              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(value, 100)}%` }}
                                  transition={{ duration: 0.8, delay: 0.3 }}
                                  className="h-full rounded-full"
                                  style={{ background: `linear-gradient(90deg, var(--neon), #0ea5e9)` }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sin desglose disponible</p>
                    )}
                  </GlowCard>
                </div>

                {/* Performance forecast */}
                {forecastData.length > 0 && (
                  <GlowCard className="p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                        Proyección rendimiento 4 semanas
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: trendColor, background: `${trendColor}15` }}>
                        Confianza {prediction.performance_confidence ? `${(prediction.performance_confidence * 100).toFixed(0)}%` : "—"}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={forecastData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="value" stroke={posColor} strokeWidth={2.5}
                          dot={{ fill: posColor, r: 4, strokeWidth: 0 }} strokeDasharray="6 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlowCard>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
                <Brain className="w-10 h-10 mb-3 opacity-30" />
                <p>Sin predicciones disponibles para este jugador</p>
              </div>
            )}
          </motion.div>
        )}

      </div>
    </div>
  );
}
