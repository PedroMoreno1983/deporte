"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { analyticsApi, categoriesApi, playersApi, injuriesApi } from "@/lib/api";
import { PDFExportButton } from "@/components/pdf/PDFExportButton";
import { TeamReportPDF } from "@/components/pdf/TeamReportPDF";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart3, Users, Target, TrendingUp, Shield, ArrowRight } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
  Cell, Legend,
} from "recharts";
import { POSITION_LABELS } from "@/lib/design-system";

const RADAR_KEYS = ["rendimiento", "goles", "asistencias", "minutos", "distancia", "carga"];
const RADAR_LABELS: Record<string, string> = {
  rendimiento: "Rendimiento", goles: "Goles", asistencias: "Asistencias",
  minutos: "Minutos", distancia: "Distancia", carga: "Carga",
};

const POSITION_COLORS: Record<string, string> = {
  goalkeeper: "#fbbf24", center_back: "#60a5fa", left_back: "#60a5fa",
  right_back: "#60a5fa", defensive_mid: "#10b981", central_mid: "#10b981",
  attacking_mid: "#10b981", left_wing: "#f87171", right_wing: "#f87171",
  center_forward: "#f87171",
};

function RadarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs bg-surface-2 border border-white/[0.08]">
      <p className="font-medium text-white/60 mb-1">{RADAR_LABELS[payload[0]?.payload?.metric] ?? payload[0]?.payload?.metric}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedPlayer, setSelectedPlayer] = useState<number | undefined>();
  const [comparePlayer, setComparePlayer] = useState<number | undefined>();

  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const { data: dash } = useQuery({ queryKey: ["dashboard", selectedCategory], queryFn: () => analyticsApi.dashboard(selectedCategory) });
  const { data: injuryStats } = useQuery({ queryKey: ["injury-stats"], queryFn: () => analyticsApi.injuryStats() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: activeInjuries = [] } = useQuery({ queryKey: ["active-injuries"], queryFn: () => injuriesApi.getActive() });
  const { data: teamRadar = [] } = useQuery({ queryKey: ["team-radar", selectedCategory], queryFn: () => analyticsApi.teamRadar(selectedCategory) });
  const { data: playerRadar } = useQuery({ queryKey: ["player-radar", selectedPlayer], queryFn: () => analyticsApi.playerRadar(selectedPlayer!), enabled: !!selectedPlayer });
  const { data: compareRadar } = useQuery({ queryKey: ["player-radar", comparePlayer], queryFn: () => analyticsApi.playerRadar(comparePlayer!), enabled: !!comparePlayer });

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
      metric: k,
      Jugador: radarObj?.player?.[k] ?? 0,
      Equipo: radarObj?.team_avg?.[k] ?? 0,
      ...(compareObj ? { Comparar: compareObj?.player?.[k] ?? 0 } : {}),
    }));

  const top8 = [...(teamRadar as any[])].sort((a, b) => (b.rendimiento ?? 0) - (a.rendimiento ?? 0)).slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Analytics" subtitle="Indicadores, benchmarks y radar de rendimiento" />
        <div className="flex items-center gap-2">
          <PDFExportButton
            document={<TeamReportPDF players={players} activeInjuries={activeInjuries} categoryName={categories?.find((c: any) => c.id === selectedCategory)?.name} />}
            fileName="reporte-equipo.pdf"
            label="Reporte equipo"
          />
          <select value={selectedCategory ?? ""} onChange={e => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
            className="input text-sm py-2">
            <option value="">Todas las categorías</option>
            {(categories as any[] ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Jugadores" value={dash?.total_players ?? 0} icon={Users} color="#0ea5e9" />
        <StatCard label="Disponibilidad" value={`${dash?.availability_rate ?? 0}%`} icon={Shield} color="#10b981" />
        <StatCard label="Rating promedio" value={dash?.avg_team_rating ? `${dash.avg_team_rating}/10` : "—"} icon={TrendingUp} color="#f59e0b" />
        <StatCard label="Partidos (30d)" value={dash?.recent_matches ?? 0} icon={BarChart3} color="#a855f7" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Radar de jugador</p>
            <div className="flex gap-2 flex-wrap">
              <select value={selectedPlayer ?? ""} onChange={e => setSelectedPlayer(e.target.value ? Number(e.target.value) : undefined)}
                className="input text-xs py-1.5 px-2">
                <option value="">Seleccionar jugador...</option>
                {(players as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <select value={comparePlayer ?? ""} onChange={e => setComparePlayer(e.target.value ? Number(e.target.value) : undefined)}
                className="input text-xs py-1.5 px-2">
                <option value="">Comparar con...</option>
                {(players as any[]).filter((p: any) => p.id !== selectedPlayer).map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>

          {!selectedPlayer ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Target className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-sm text-white/30">Selecciona un jugador para ver su radar</p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={buildRadarData(playerRadar, compareRadar)}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="metric"
                    tick={({ x, y, payload }: any) => (
                      <text x={x} y={y} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9} fontWeight={600}>
                        {RADAR_LABELS[payload.value]}
                      </text>
                    )} />
                  <Radar name="Equipo (prom.)" dataKey="Equipo" stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.04)" strokeWidth={1.5} />
                  <Radar name="Jugador" dataKey="Jugador" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} />
                  {comparePlayer && <Radar name="Comparar" dataKey="Comparar" stroke="#a855f7" fill="rgba(168,85,247,0.08)" strokeWidth={2} dot={{ fill: "#a855f7", r: 3 }} />}
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Tooltip content={<RadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
              {playerRadar && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                  {RADAR_KEYS.map(k => {
                    const val = playerRadar.player?.[k] ?? 0;
                    const avg = playerRadar.team_avg?.[k] ?? 0;
                    const color = val >= avg ? "#10b981" : "#f97316";
                    return (
                      <div key={k}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[9px] text-white/30">{RADAR_LABELS[k]}</span>
                          <span className="text-[9px] font-bold" style={{ color }}>{val}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${val}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>

        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Benchmark equipo — Top rendimiento</p>
          {top8.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-white/30">Sin datos de partidos aún</div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px]">
              {top8.map((p: any, i: number) => {
                const color = POSITION_COLORS[p.position] ?? "#64748b";
                const score = p.rendimiento ?? 0;
                const isSelected = selectedPlayer === p.player_id;
                return (
                  <div key={p.player_id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                      isSelected ? "bg-white/[0.03] border-white/[0.08]" : "bg-transparent border-transparent hover:bg-white/[0.02]"
                    }`}
                    onClick={() => setSelectedPlayer(p.player_id === selectedPlayer ? undefined : p.player_id)}>
                    <span className="text-xs font-mono font-bold w-5 text-center text-white/20">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
                      style={{ borderColor: `${color}40`, color, background: `${color}10` }}>
                      {p.jersey ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white/80 truncate">{p.player_name}</p>
                      <p className="text-[9px] text-white/20">{POSITION_LABELS[p.position] ?? p.position}</p>
                    </div>
                    <div className="flex gap-0.5 items-end h-5">
                      {RADAR_KEYS.slice(0, 4).map(k => (
                        <div key={k} className="w-1.5 rounded-sm" style={{ height: `${Math.max(3, (p[k] ?? 0) / 100 * 20)}px`, background: color, opacity: 0.6 }} />
                      ))}
                    </div>
                    <span className="text-sm font-bold w-8 text-right" style={{ color }}>{score}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {selectedPlayer && comparePlayer && playerRadar && compareRadar && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Comparación head-to-head</p>
              <div className="flex items-center gap-3 text-sm font-bold">
                <span className="text-emerald-400">{(players as any[]).find((p: any) => p.id === selectedPlayer)?.full_name ?? "Jugador A"}</span>
                <ArrowRight className="w-4 h-4 text-white/20" />
                <span className="text-purple-400">{(players as any[]).find((p: any) => p.id === comparePlayer)?.full_name ?? "Jugador B"}</span>
              </div>
            </div>
            <div className="space-y-3">
              {RADAR_KEYS.map(k => {
                const a = playerRadar.player?.[k] ?? 0;
                const b = compareRadar.player?.[k] ?? 0;
                const total = (a + b) || 1;
                const aWins = a >= b;
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className={`font-bold w-10 text-right ${aWins ? "text-emerald-400" : "text-white/30"}`}>{a.toFixed(0)}</span>
                      <span className="flex-1 text-center font-medium text-white/30">{RADAR_LABELS[k]}</span>
                      <span className={`font-bold w-10 text-left ${!aWins ? "text-purple-400" : "text-white/30"}`}>{b.toFixed(0)}</span>
                    </div>
                    <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                      <div className="rounded-l-full transition-all duration-700" style={{ width: `${(a / total) * 100}%`, background: "#10b981", opacity: aWins ? 1 : 0.4 }} />
                      <div className="rounded-r-full transition-all duration-700" style={{ width: `${(b / total) * 100}%`, background: "#a855f7", opacity: !aWins ? 1 : 0.4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const aWins = RADAR_KEYS.filter(k => (playerRadar.player?.[k] ?? 0) >= (compareRadar.player?.[k] ?? 0)).length;
              const bWins = RADAR_KEYS.length - aWins;
              const playerA = (players as any[]).find((p: any) => p.id === selectedPlayer);
              const playerB = (players as any[]).find((p: any) => p.id === comparePlayer);
              return (
                <div className="mt-5 pt-4 flex items-center justify-center gap-6 border-t border-white/[0.06]">
                  <div className="text-center"><p className="text-2xl font-bold text-emerald-400">{aWins}</p><p className="text-xs text-white/30">{playerA?.first_name ?? "A"}</p></div>
                  <div className="text-center px-4 border-x border-white/[0.06]"><p className="text-xs font-bold uppercase tracking-widest text-white/20">métricas ganadas</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-purple-400">{bWins}</p><p className="text-xs text-white/30">{playerB?.first_name ?? "B"}</p></div>
                </div>
              );
            })()}
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Jugadores por posición</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={positionData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="position" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} width={90} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {positionData.map((_, i) => <Cell key={i} fill={["#60a5fa", "#10b981", "#f87171", "#f59e0b", "#a855f7"][i % 5]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Tendencia lesiones (6m)</p>
            <div className="flex gap-3 text-xs text-white/30">
              <span>Total: <strong className="text-white">{injuryStats?.total ?? 0}</strong></span>
              <span>Prom.: <strong className="text-white">{injuryStats?.avg_days_out?.toFixed(0) ?? "—"}d</strong></span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="injuries" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
