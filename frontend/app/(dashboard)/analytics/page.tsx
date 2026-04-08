"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { analyticsApi, categoriesApi, playersApi, injuriesApi } from "@/lib/api";
import { PDFExportButton } from "@/components/pdf/PDFExportButton";
import { TeamReportPDF } from "@/components/pdf/TeamReportPDF";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { BarChart3, Users, Target, TrendingUp, Shield, ArrowRight } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
  Cell, Legend,
} from "recharts";
import { POSITION_LABELS } from "@/lib/utils";

const RADAR_KEYS = ["rendimiento", "goles", "asistencias", "minutos", "distancia", "carga"];
const RADAR_LABELS: Record<string, string> = {
  rendimiento: "Rendimiento", goles: "Goles", asistencias: "Asistencias",
  minutos: "Minutos", distancia: "Distancia", carga: "Carga",
};

const POSITION_COLORS: Record<string, string> = {
  goalkeeper: "#fbbf24", center_back: "#60a5fa", left_back: "#60a5fa",
  right_back: "#60a5fa", defensive_mid: "#00ff87", central_mid: "#00ff87",
  attacking_mid: "#00ff87", left_wing: "#f87171", right_wing: "#f87171",
  center_forward: "#f87171",
};

const s = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] as any },
});

function RadarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs border"
      style={{ background: "rgba(8,15,32,0.97)", borderColor: "rgba(255,255,255,0.12)" }}>
      <p className="font-bold text-white/70 mb-1">{RADAR_LABELS[payload[0]?.payload?.metric] ?? payload[0]?.payload?.metric}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-black">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedPlayer, setSelectedPlayer]     = useState<number | undefined>();
  const [comparePlayer, setComparePlayer]       = useState<number | undefined>();

  const { data: categories }    = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const { data: dash }          = useQuery({ queryKey: ["dashboard", selectedCategory], queryFn: () => analyticsApi.dashboard(selectedCategory) });
  const { data: injuryStats }   = useQuery({ queryKey: ["injury-stats"], queryFn: () => analyticsApi.injuryStats() });
  const { data: players = [] }  = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: activeInjuries = [] } = useQuery({ queryKey: ["active-injuries"], queryFn: () => injuriesApi.getActive() });
  const { data: teamRadar = [] } = useQuery({ queryKey: ["team-radar", selectedCategory], queryFn: () => analyticsApi.teamRadar(selectedCategory) });
  const { data: playerRadar }   = useQuery({
    queryKey: ["player-radar", selectedPlayer],
    queryFn:  () => analyticsApi.playerRadar(selectedPlayer!),
    enabled:  !!selectedPlayer,
  });
  const { data: compareRadar } = useQuery({
    queryKey: ["player-radar", comparePlayer],
    queryFn:  () => analyticsApi.playerRadar(comparePlayer!),
    enabled:  !!comparePlayer,
  });

  const byPosition = (players as any[]).reduce((acc: Record<string, number>, p: any) => {
    acc[p.position] = (acc[p.position] || 0) + 1; return acc;
  }, {});
  const positionData = Object.entries(byPosition)
    .map(([pos, count]) => ({ position: POSITION_LABELS[pos] || pos, count: count as number }))
    .sort((a, b) => b.count - a.count);

  const monthData = injuryStats?.by_month
    ? Object.entries(injuryStats.by_month).slice(-6).map(([k, v]) => ({ month: k.slice(5), injuries: v as number }))
    : [];

  const buildRadarData = (radarObj: any, compareObj?: any) =>
    RADAR_KEYS.map(k => ({
      metric:    k,
      Jugador:   radarObj?.player?.[k]   ?? 0,
      Equipo:    radarObj?.team_avg?.[k] ?? 0,
      ...(compareObj ? { Comparar: compareObj?.player?.[k] ?? 0 } : {}),
    }));

  const top8 = [...(teamRadar as any[])]
    .sort((a, b) => (b.rendimiento ?? 0) - (a.rendimiento ?? 0))
    .slice(0, 8);

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">

      {/* Header */}
      <motion.div {...s(0)} className="flex items-center justify-between flex-wrap gap-3 pl-12 lg:pl-0">
        <div className="flex items-center justify-between gap-4 pl-12 lg:pl-0">
          <PageHeader icon={BarChart3} title="Analytics" description="Indicadores, benchmarks y radar de rendimiento" className="mb-0 flex-1" />
          <PDFExportButton
            document={
              <TeamReportPDF
                players={players}
                activeInjuries={activeInjuries}
                categoryName={categories?.find((c: any) => c.id === selectedCategory)?.name}
              />
            }
            fileName="reporte-equipo.pdf"
            label="Reporte equipo"
          />
        </div>
        <select value={selectedCategory ?? ""}
          onChange={e => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
          className="text-sm rounded-xl px-3 py-2 focus:outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}>
          <option value="">Todas las categorías</option>
          {(categories as any[] ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users,      label: "Jugadores",       value: dash?.total_players ?? 0,                            color: "#60a5fa" },
          { icon: Shield,     label: "Disponibilidad",  value: `${dash?.availability_rate ?? 0}%`,                  color: "#00ff87" },
          { icon: TrendingUp, label: "Rating promedio", value: dash?.avg_team_rating ? `${dash.avg_team_rating}/10` : "—", color: "#f59e0b" },
          { icon: BarChart3,  label: "Partidos (30d)",  value: dash?.recent_matches ?? 0,                           color: "#a855f7" },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div key={label} {...s(i + 1)}>
            <GlowCard className="p-5 rounded-2xl" style={{ border: `1px solid ${color}20` }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}28` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-black" style={{ color }}>{value}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      {/* Radar + Benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Player radar */}
        <motion.div {...s(5)}>
          <GlowCard className="p-5 rounded-2xl h-full" style={{ border: "1px solid rgba(0,255,135,0.15)" }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>Radar de jugador</p>
              <div className="flex gap-2 flex-wrap">
                <select value={selectedPlayer ?? ""}
                  onChange={e => setSelectedPlayer(e.target.value ? Number(e.target.value) : undefined)}
                  className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                  style={{ background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.25)", color: "#00ff87" }}>
                  <option value="">Seleccionar jugador...</option>
                  {(players as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <select value={comparePlayer ?? ""}
                  onChange={e => setComparePlayer(e.target.value ? Number(e.target.value) : undefined)}
                  className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                  style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", color: "#a855f7" }}>
                  <option value="">Comparar con...</option>
                  {(players as any[]).filter((p: any) => p.id !== selectedPlayer).map((p: any) =>
                    <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>

            {!selectedPlayer ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Target className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Selecciona un jugador para ver su radar</p>
                </div>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={buildRadarData(playerRadar, compareRadar)}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="metric"
                      tick={({ x, y, payload }: any) => (
                        <text x={x} y={y} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={9} fontWeight={700}>
                          {RADAR_LABELS[payload.value]}
                        </text>
                      )} />
                    <Radar name="Equipo (prom.)" dataKey="Equipo" stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.04)" strokeWidth={1.5} />
                    <Radar name={(players as any[]).find((p: any) => p.id === selectedPlayer)?.full_name ?? "Jugador"} dataKey="Jugador" stroke="#00ff87" fill="rgba(0,255,135,0.12)" strokeWidth={2} dot={{ fill: "#00ff87", r: 3 }} />
                    {comparePlayer && (
                      <Radar name={(players as any[]).find((p: any) => p.id === comparePlayer)?.full_name ?? "Comparar"} dataKey="Comparar" stroke="#a855f7" fill="rgba(168,85,247,0.10)" strokeWidth={2} dot={{ fill: "#a855f7", r: 3 }} />
                    )}
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                    <Tooltip content={<RadarTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>

                {playerRadar && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                    {RADAR_KEYS.map(k => {
                      const val   = playerRadar.player?.[k] ?? 0;
                      const avg   = playerRadar.team_avg?.[k] ?? 0;
                      const color = val >= avg ? "#00ff87" : "#f97316";
                      return (
                        <div key={k}>
                          <div className="flex justify-between mb-0.5">
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{RADAR_LABELS[k]}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color }}>{val}</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div className="h-full rounded-full" style={{ width: `${val}%`, background: color, transition: "width 0.6s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </GlowCard>
        </motion.div>

        {/* Team benchmark */}
        <motion.div {...s(6)}>
          <GlowCard className="p-5 rounded-2xl h-full" style={{ border: "1px solid rgba(168,85,247,0.15)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "var(--text-muted)" }}>
              Benchmark equipo — Top rendimiento
            </p>
            {top8.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sin datos de partidos aún</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 400 }}>
                {top8.map((p: any, i: number) => {
                  const color   = POSITION_COLORS[p.position] ?? "#64748b";
                  const score   = p.rendimiento ?? 0;
                  const isSelected = selectedPlayer === p.player_id;
                  return (
                    <div key={p.player_id}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                      style={{ background: isSelected ? `${color}10` : "rgba(255,255,255,0.02)", border: `1px solid ${isSelected ? `${color}30` : "rgba(255,255,255,0.05)"}`, transition: "all 0.15s" }}
                      onClick={() => setSelectedPlayer(p.player_id === selectedPlayer ? undefined : p.player_id)}>
                      <span className="text-xs font-mono font-black w-5 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>{i + 1}</span>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                        style={{ background: `${color}15`, border: `1.5px solid ${color}50`, color }}>
                        {p.jersey ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{p.player_name}</p>
                        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{POSITION_LABELS[p.position] ?? p.position}</p>
                      </div>
                      <div className="flex gap-0.5 items-end h-5">
                        {RADAR_KEYS.slice(0, 4).map(k => (
                          <div key={k} className="w-1.5 rounded-sm"
                            style={{ height: `${Math.max(3, (p[k] ?? 0) / 100 * 20)}px`, background: color, opacity: 0.7 }} />
                        ))}
                      </div>
                      <span className="text-sm font-black w-8 text-right" style={{ color }}>{score}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </GlowCard>
        </motion.div>
      </div>

      {/* Head-to-head comparison panel */}
      {selectedPlayer && comparePlayer && playerRadar && compareRadar && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <GlowCard className="p-5 rounded-2xl" style={{ border: "1px solid rgba(168,85,247,0.2)" }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
                Comparación head-to-head
              </p>
              <div className="flex items-center gap-3 text-sm font-bold">
                <span style={{ color: "#00ff87" }}>
                  {(players as any[]).find((p: any) => p.id === selectedPlayer)?.full_name ?? "Jugador A"}
                </span>
                <ArrowRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "#a855f7" }}>
                  {(players as any[]).find((p: any) => p.id === comparePlayer)?.full_name ?? "Jugador B"}
                </span>
              </div>
            </div>

            {/* Metric rows */}
            <div className="space-y-3">
              {RADAR_KEYS.map(k => {
                const a = playerRadar.player?.[k] ?? 0;
                const b = compareRadar.player?.[k] ?? 0;
                const total = (a + b) || 1;
                const aWins = a >= b;
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="font-black w-10 text-right" style={{ color: aWins ? "#00ff87" : "rgba(255,255,255,0.4)" }}>
                        {a.toFixed(0)}
                      </span>
                      <span className="flex-1 text-center font-semibold" style={{ color: "var(--text-muted)" }}>
                        {RADAR_LABELS[k]}
                      </span>
                      <span className="font-black w-10 text-left" style={{ color: !aWins ? "#a855f7" : "rgba(255,255,255,0.4)" }}>
                        {b.toFixed(0)}
                      </span>
                    </div>
                    {/* Dual bar */}
                    <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                      <div
                        className="rounded-l-full transition-all duration-700"
                        style={{ width: `${(a / total) * 100}%`, background: "#00ff87", opacity: aWins ? 1 : 0.4 }}
                      />
                      <div
                        className="rounded-r-full transition-all duration-700"
                        style={{ width: `${(b / total) * 100}%`, background: "#a855f7", opacity: !aWins ? 1 : 0.4 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Winner summary */}
            {(() => {
              const aWins = RADAR_KEYS.filter(k => (playerRadar.player?.[k] ?? 0) >= (compareRadar.player?.[k] ?? 0)).length;
              const bWins = RADAR_KEYS.length - aWins;
              const playerA = (players as any[]).find((p: any) => p.id === selectedPlayer);
              const playerB = (players as any[]).find((p: any) => p.id === comparePlayer);
              return (
                <div className="mt-5 pt-4 flex items-center justify-center gap-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <div className="text-center">
                    <p className="text-2xl font-black" style={{ color: "#00ff87" }}>{aWins}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{playerA?.first_name ?? "A"}</p>
                  </div>
                  <div className="text-center px-4" style={{ borderLeft: "1px solid var(--border-subtle)", borderRight: "1px solid var(--border-subtle)" }}>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>métricas ganadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black" style={{ color: "#a855f7" }}>{bWins}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{playerB?.first_name ?? "B"}</p>
                  </div>
                </div>
              );
            })()}
          </GlowCard>
        </motion.div>
      )}

      {/* Bottom charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <motion.div {...s(7)}>
          <GlowCard className="p-5 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "var(--text-muted)" }}>Jugadores por posición</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={positionData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="position" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(8,15,32,0.97)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {positionData.map((_, i) => (
                    <Cell key={i} fill={["#60a5fa", "#00ff87", "#f87171", "#f59e0b", "#a855f7"][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlowCard>
        </motion.div>

        <motion.div {...s(8)}>
          <GlowCard className="p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>Tendencia lesiones (6m)</p>
              <div className="flex gap-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span>Total: <strong style={{ color: "white" }}>{injuryStats?.total ?? 0}</strong></span>
                <span>Prom.: <strong style={{ color: "white" }}>{injuryStats?.avg_days_out?.toFixed(0) ?? "—"}d</strong></span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(8,15,32,0.97)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }} />
                <Line type="monotone" dataKey="injuries" stroke="#ef4444" strokeWidth={2.5}
                  dot={{ fill: "#ef4444", r: 4, strokeWidth: 0 }} name="Lesiones" />
              </LineChart>
            </ResponsiveContainer>
          </GlowCard>
        </motion.div>
      </div>
    </div>
  );
}
