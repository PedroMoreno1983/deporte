"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { analyticsApi, predictionsApi } from "@/lib/api";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { GlowCard } from "@/components/ui/GlowCard";
import {
  Users, AlertTriangle, Trophy, Activity, TrendingDown, ShieldCheck,
  Zap, HeartPulse, Target
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";
import Link from "next/link";

const s = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] as any },
});

const STATUS_COLORS: Record<string, string> = {
  available: "#00ff87", injured: "#ff3b30",
  recovering: "#f97316", suspended: "#f59e0b", inactive: "#475569",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs border"
      style={{ background: "rgba(8,15,32,0.95)", borderColor: "rgba(255,255,255,0.12)" }}>
      <p className="font-semibold text-white/70 mb-0.5">{payload[0]?.name ?? payload[0]?.payload?.month}</p>
      <p className="font-black text-base" style={{ color: payload[0]?.payload?.fill ?? "#00ff87" }}>
        {payload[0]?.value}
      </p>
    </div>
  );
};

export default function DashboardPage() {
  const { data: dash, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => analyticsApi.dashboard(),
  });
  const { data: teamRisk } = useQuery({
    queryKey: ["team-risk"],
    queryFn: () => predictionsApi.teamRisk(),
  });
  const { data: injuryStats } = useQuery({
    queryKey: ["injury-stats"],
    queryFn: () => analyticsApi.injuryStats(),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-64 skeleton rounded-xl mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="skeleton h-72 col-span-2 rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const statusData = dash?.by_status
    ? Object.entries(dash.by_status).map(([name, value]) => ({
        name: ({
          available: "Disponible", injured: "Lesionado",
          recovering: "Recuperación", suspended: "Suspendido", inactive: "Inactivo"
        } as Record<string, string>)[name] ?? name,
        value: value as number,
        fill: STATUS_COLORS[name] ?? "#475569",
      }))
    : [];

  const topRisk = ((teamRisk ?? []) as Array<{
    player_id: number; player_name: string; risk_score: number; risk_level: string
  }>).slice(0, 5);

  const monthData = injuryStats?.by_month
    ? Object.entries(injuryStats.by_month).slice(-6).map(([k, v]) => ({
        month: k.slice(5), injuries: v as number,
      }))
    : [];

  const availRate = dash?.availability_rate ?? 0;
  const availColor = availRate >= 80 ? "#00ff87" : availRate >= 60 ? "#f59e0b" : "#ff3b30";

  const RISK_COLOR: Record<string, string> = {
    low: "#00ff87", medium: "#f59e0b", high: "#f97316", critical: "#ff3b30",
  };

  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">

      {/* ── Header ───────────────────────────────────────── */}
      <motion.div {...s(0)} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Resumen general del equipo
          </p>
        </div>
        <div
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl font-semibold"
          style={{
            background: "rgba(0,255,135,0.10)",
            border: "1px solid rgba(0,255,135,0.28)",
            color: "#00ff87",
            boxShadow: "0 0 16px rgba(0,255,135,0.12)",
          }}
        >
          <div className="status-dot" style={{ width: 7, height: 7 }} />
          En tiempo real
        </div>
      </motion.div>

      {/* ── Hero row: disponibilidad + 3 KPIs ────────────── */}
      <div className="grid grid-cols-4 gap-4">

        {/* HERO — Disponibilidad */}
        <motion.div {...s(1)} className="col-span-2">
          <GlowCard
            className="relative h-full p-6 rounded-2xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${availColor}14 0%, rgba(8,15,32,0.85) 55%)`,
              border: `1px solid ${availColor}30`,
              boxShadow: `0 0 40px ${availColor}12`,
            }}
          >
            {/* Top accent */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${availColor}, transparent)`,
                boxShadow: `0 0 12px ${availColor}`,
              }}
            />

            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: `${availColor}90` }}>
                  DISPONIBILIDAD DEL PLANTEL
                </p>
                <div className="flex items-end gap-3">
                  <AnimatedCounter
                    value={availRate}
                    suffix="%"
                    decimals={1}
                    className="text-7xl font-black leading-none"
                    style={{ color: availColor, textShadow: `0 0 40px ${availColor}60` } as any}
                  />
                </div>
                <p className="text-sm mt-3" style={{ color: "rgba(148,163,184,0.8)" }}>
                  <span className="font-black text-base" style={{ color: availColor }}>{dash?.available}</span>
                  <span className="mx-1.5 text-white/30">/</span>
                  <span className="font-bold text-white">{dash?.total_players}</span>
                  <span className="ml-2">jugadores listos</span>
                </p>
              </div>
              <div
                className="p-3.5 rounded-2xl shrink-0"
                style={{
                  background: `${availColor}14`,
                  border: `1px solid ${availColor}30`,
                  boxShadow: `0 0 20px ${availColor}20`,
                }}
              >
                <ShieldCheck className="w-8 h-8" style={{ color: availColor }} />
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${availRate}%` }}
                  transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1], delay: 0.6 }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${availColor}, ${availColor}aa)`,
                    boxShadow: `0 0 12px ${availColor}70`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] mt-1.5" style={{ color: "rgba(148,163,184,0.5)" }}>
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </GlowCard>
        </motion.div>

        {/* KPI — Lesiones */}
        <motion.div {...s(2)}>
          <GlowCard
            className="relative p-5 rounded-2xl h-full"
            style={{
              background: "linear-gradient(135deg, rgba(255,59,48,0.14) 0%, rgba(8,15,32,0.85) 60%)",
              border: "1px solid rgba(255,59,48,0.28)",
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: "linear-gradient(90deg, transparent, #ff3b30, transparent)", boxShadow: "0 0 10px #ff3b30" }}
            />
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-2.5 rounded-xl"
                style={{ background: "rgba(255,59,48,0.14)", border: "1px solid rgba(255,59,48,0.30)" }}
              >
                <AlertTriangle className="w-5 h-5" style={{ color: "#ff3b30" }} />
              </div>
              <Link href="/injuries">
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg"
                  style={{ color: "#ff3b30", background: "rgba(255,59,48,0.12)", border: "1px solid rgba(255,59,48,0.22)" }}>
                  Ver →
                </span>
              </Link>
            </div>
            <AnimatedCounter value={dash?.active_injuries ?? 0} className="text-5xl font-black"
              style={{ color: "#ff3b30", textShadow: "0 0 30px rgba(255,59,48,0.50)" } as any} />
            <p className="text-xs mt-1.5 font-semibold" style={{ color: "rgba(148,163,184,0.7)" }}>Lesiones activas</p>
            <p className="text-sm mt-2 font-black" style={{ color: "#ff3b30" }}>
              {dash?.injured ?? 0} <span className="font-normal text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>jugadores fuera</span>
            </p>
          </GlowCard>
        </motion.div>

        {/* KPI — Partidos */}
        <motion.div {...s(3)}>
          <GlowCard
            className="relative p-5 rounded-2xl h-full"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(8,15,32,0.85) 60%)",
              border: "1px solid rgba(245,158,11,0.28)",
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: "linear-gradient(90deg, transparent, #f59e0b, transparent)", boxShadow: "0 0 10px #f59e0b" }}
            />
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-2.5 rounded-xl"
                style={{ background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.30)" }}
              >
                <Trophy className="w-5 h-5" style={{ color: "#f59e0b" }} />
              </div>
              <Link href="/matches">
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg"
                  style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.22)" }}>
                  Ver →
                </span>
              </Link>
            </div>
            <AnimatedCounter value={dash?.recent_matches ?? 0} className="text-5xl font-black"
              style={{ color: "#f59e0b", textShadow: "0 0 30px rgba(245,158,11,0.50)" } as any} />
            <p className="text-xs mt-1.5 font-semibold" style={{ color: "rgba(148,163,184,0.7)" }}>Partidos (30d)</p>
            {dash?.avg_team_rating && (
              <p className="text-sm mt-2 font-black" style={{ color: "#f59e0b" }}>
                {dash.avg_team_rating}<span className="font-normal text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>/10 rating prom.</span>
              </p>
            )}
          </GlowCard>
        </motion.div>
      </div>

      {/* ── Charts row ───────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Estado del plantel */}
        <motion.div {...s(4)}>
          <GlowCard className="p-5 rounded-2xl h-full">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "var(--text-muted)" }}>
              Estado del plantel
            </p>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%" cy="50%"
                  innerRadius={40} outerRadius={62}
                  dataKey="value"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill}
                      style={{ filter: `drop-shadow(0 0 6px ${entry.fill}60)` }} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: item.fill, boxShadow: `0 0 6px ${item.fill}` }} />
                    <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                  </div>
                  <span className="font-black" style={{ color: item.fill }}>{item.value}</span>
                </div>
              ))}
            </div>
          </GlowCard>
        </motion.div>

        {/* Tendencia lesiones */}
        <motion.div {...s(5)}>
          <GlowCard className="p-5 rounded-2xl h-full">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "var(--text-muted)" }}>
              Tendencia de lesiones (6m)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthData}>
                <defs>
                  <linearGradient id="injGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff3b30" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ff3b30" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="injuries"
                  stroke="#ff3b30" strokeWidth={2.5}
                  fill="url(#injGrad)"
                  dot={{ fill: "#ff3b30", r: 3.5, strokeWidth: 0, filter: "drop-shadow(0 0 4px #ff3b30)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlowCard>
        </motion.div>

        {/* Top riesgo */}
        <motion.div {...s(6)}>
          <GlowCard className="p-5 rounded-2xl h-full"
            style={{ border: "1px solid rgba(168,85,247,0.20)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg" style={{ background: "rgba(168,85,247,0.14)", border: "1px solid rgba(168,85,247,0.25)" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "#a855f7" }} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
                Mayor riesgo de lesión
              </p>
            </div>
            {topRisk.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--text-muted)" }}>
                Sin datos disponibles
              </div>
            ) : (
              <div className="space-y-3">
                {topRisk.map((p, i) => {
                  const color = RISK_COLOR[p.risk_level] ?? "#64748b";
                  return (
                    <Link key={p.player_id} href={`/players/${p.player_id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-xl transition-colors"
                        style={{ background: `${color}08` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = `${color}14`)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = `${color}08`)}
                      >
                        <span className="text-xs font-mono font-bold w-5 text-center" style={{ color: "rgba(148,163,184,0.5)" }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white/85 truncate">{p.player_name}</p>
                          <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${p.risk_score}%` }}
                              transition={{ delay: 0.9 + i * 0.1, duration: 0.7 }}
                              className="h-full rounded-full"
                              style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-black font-mono" style={{ color }}>{p.risk_score}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </GlowCard>
        </motion.div>
      </div>

      {/* ── Bottom stats ──────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total jugadores",   value: dash?.total_players ?? 0,          icon: Users,       color: "#0ea5e9" },
          { label: "En recuperación",   value: dash?.recovering ?? 0,             icon: HeartPulse,  color: "#f97316" },
          { label: "Suspendidos",       value: dash?.suspended ?? 0,              icon: AlertTriangle, color: "#f59e0b" },
          { label: "Días prom. de baja",value: injuryStats?.avg_days_out ?? 0,   icon: Target,      color: "#a855f7", decimals: 0 },
        ].map(({ label, value, icon: Icon, color, decimals = 0 }, i) => (
          <motion.div key={label} {...s(7 + i)}>
            <GlowCard
              className="p-4 rounded-xl flex items-center gap-3"
              style={{ border: `1px solid ${color}20` }}
            >
              <div
                className="p-2.5 rounded-xl shrink-0"
                style={{
                  background: `${color}12`,
                  border: `1px solid ${color}28`,
                  boxShadow: `0 0 12px ${color}20`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <AnimatedCounter
                  value={Number(value)}
                  decimals={decimals}
                  className="text-2xl font-black"
                  style={{ color } as any}
                />
                <p className="text-xs leading-tight mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
