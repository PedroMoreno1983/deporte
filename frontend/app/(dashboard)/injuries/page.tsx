"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { injuriesApi, analyticsApi } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertTriangle, Activity, Calendar, Clock, TrendingUp, Zap } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import Link from "next/link";

const SEVERITY_COLORS: Record<string, string> = {
  grade_1: "#00ff87",
  grade_2: "#f59e0b",
  grade_3: "#f97316",
  grade_4: "#ff3b30",
};
const SEVERITY_LABELS: Record<string, string> = {
  grade_1: "Grado I — Leve",
  grade_2: "Grado II — Moderado",
  grade_3: "Grado III — Severo",
  grade_4: "Grado IV — Quirúrgico",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border-medium)" }}>
      <p className="font-semibold text-white/80">{payload[0]?.name ?? payload[0]?.payload?.month}</p>
      <p className="font-bold" style={{ color: "var(--danger)" }}>{payload[0]?.value}</p>
    </div>
  );
};

export default function InjuriesPage() {
  const { data: activeInjuries, isLoading } = useQuery({
    queryKey: ["active-injuries"],
    queryFn: () => injuriesApi.getActive(),
  });

  const { data: injuryStats } = useQuery({
    queryKey: ["injury-stats"],
    queryFn: () => analyticsApi.injuryStats(),
  });

  const severityData = injuryStats?.by_severity
    ? Object.entries(injuryStats.by_severity).map(([k, v]) => ({
        name: SEVERITY_LABELS[k] ?? k, value: v as number, key: k,
      }))
    : [];

  const monthData = injuryStats?.by_month
    ? Object.entries(injuryStats.by_month).slice(-6).map(([k, v]) => ({
        month: k.slice(5), count: v as number,
      }))
    : [];

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] as any },
  });

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <PageHeader
        icon={AlertTriangle}
        title="Lesiones"
        description={`${injuryStats?.active ?? 0} activas · ${injuryStats?.total ?? 0} históricas`}
        iconColor="text-red-400"
        iconBg="bg-red-500/10 border-red-500/20"
        badgeColor="text-red-400 bg-red-500/10 border-red-500/20"
        badge={injuryStats?.active ? `${injuryStats.active} activas` : undefined}
        className="pl-12 lg:pl-0"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div {...stagger(0)}>
          <GlowCard className="p-5 rounded-2xl text-center">
            <div className="inline-flex p-2.5 rounded-xl mb-3"
              style={{ background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)" }}>
              <Zap className="w-5 h-5" style={{ color: "var(--danger)" }} />
            </div>
            <AnimatedCounter value={injuryStats?.active ?? 0} className="text-4xl font-black" style={{ color: "var(--danger)" } as any} />
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>Lesiones activas</p>
          </GlowCard>
        </motion.div>

        <motion.div {...stagger(1)}>
          <GlowCard className="p-5 rounded-2xl text-center">
            <div className="inline-flex p-2.5 rounded-xl mb-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)" }}>
              <Activity className="w-5 h-5 text-white/40" />
            </div>
            <AnimatedCounter value={injuryStats?.total ?? 0} className="text-4xl font-black" />
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>Total históricas</p>
          </GlowCard>
        </motion.div>

        <motion.div {...stagger(2)}>
          <GlowCard className="p-5 rounded-2xl text-center">
            <div className="inline-flex p-2.5 rounded-xl mb-3"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Clock className="w-5 h-5" style={{ color: "#f59e0b" }} />
            </div>
            <div className="text-4xl font-black" style={{ color: "#f59e0b" }}>
              {injuryStats?.avg_days_out?.toFixed(0) ?? "—"}
            </div>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>Días promedio de baja</p>
          </GlowCard>
        </motion.div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Severity donut */}
        <motion.div {...stagger(3)}>
          <GlowCard className="p-5 rounded-2xl h-full">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Por severidad
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%" cy="50%"
                  innerRadius={46} outerRadius={68}
                  dataKey="value"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={SEVERITY_COLORS[entry.key] ?? "#475569"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-3">
              {severityData.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SEVERITY_COLORS[item.key] }} />
                    <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                  </div>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </GlowCard>
        </motion.div>

        {/* Monthly trend */}
        <motion.div {...stagger(4)}>
          <GlowCard className="p-5 rounded-2xl h-full">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Tendencia mensual (últimos 6 meses)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  fill="var(--danger)"
                  radius={[6, 6, 0, 0]}
                  style={{ filter: "drop-shadow(0 0 6px rgba(255,59,48,0.4))" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </GlowCard>
        </motion.div>
      </div>

      {/* Active injuries — medical cards */}
      <motion.div {...stagger(5)}>
        <GlowCard className="rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: "rgba(255,59,48,0.1)" }}>
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--danger)" }} />
              </div>
              <h3 className="text-sm font-bold">Lesiones activas</h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ color: "var(--danger)", background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)" }}>
              {activeInjuries?.length ?? 0} jugadores fuera
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              <Activity className="w-5 h-5 mx-auto mb-2 animate-pulse" style={{ color: "var(--neon)" }} />
              Cargando lesiones...
            </div>
          ) : activeInjuries?.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex p-4 rounded-2xl mb-4"
                style={{ background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.15)" }}>
                <Activity className="w-7 h-7" style={{ color: "var(--neon)" }} />
              </div>
              <p className="font-semibold text-white/60">Sin lesiones activas</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>El plantel está en óptimas condiciones</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
              {activeInjuries?.map((inj: {
                id: number; player_id: number; player_name?: string; injury_type: string; body_zone: string;
                severity: string; injury_date: string; estimated_days_out?: number; treatment?: string;
              }, i: number) => {
                const color = SEVERITY_COLORS[inj.severity] ?? "#64748b";
                return (
                  <motion.div
                    key={inj.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-start gap-4 px-5 py-4 transition-colors"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Severity indicator */}
                    <div
                      className="w-1.5 self-stretch rounded-full shrink-0 mt-0.5"
                      style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link href={`/players/${inj.player_id}`}>
                          <span className="text-sm font-bold text-white/90 hover:text-white transition-colors cursor-pointer">
                            {inj.player_name ?? `Jugador #${inj.player_id}`}
                          </span>
                        </Link>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ color, background: `${color}15` }}>
                          {SEVERITY_LABELS[inj.severity]}
                        </span>
                      </div>
                      <p className="text-sm text-white/70">{inj.injury_type}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {inj.body_zone.replace(/_/g, " ")}
                        {inj.treatment && ` · ${inj.treatment}`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                        <Calendar className="w-3 h-3" />
                        {inj.injury_date}
                      </div>
                      {inj.estimated_days_out && (
                        <div className="flex items-center gap-1 text-xs font-bold justify-end"
                          style={{ color }}>
                          <Clock className="w-3 h-3" />
                          {inj.estimated_days_out}d estimados
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </GlowCard>
      </motion.div>
    </div>
  );
}
