"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, predictionsApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import {
  Users, AlertTriangle, Trophy, ShieldCheck,
  HeartPulse, Target, Zap, TrendingUp,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  available:  "#22C55E",
  injured:    "#EF4444",
  recovering: "#F97316",
  suspended:  "#F59E0B",
  inactive:   "#64748b",
};
const STATUS_LABELS: Record<string, string> = {
  available: "Disponible", injured: "Lesionado",
  recovering: "Recuperación", suspended: "Suspendido", inactive: "Inactivo",
};

const RISK_COLOR: Record<string, string> = {
  low: "#22C55E", medium: "#F59E0B", high: "#F97316", critical: "#EF4444",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{ background: "var(--surface-3)", border: "1px solid var(--border-medium)" }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-bold" style={{ color: p.color ?? p.fill }}>
          {p.name ?? ""}: {p.value}
        </p>
      ))}
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
      <div className="space-y-6">
        <div className="h-10 w-52 skeleton rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-[14px]" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="skeleton h-64 md:col-span-2 rounded-[14px]" />
          <div className="skeleton h-64 rounded-[14px]" />
        </div>
      </div>
    );
  }

  const statusData = dash?.by_status
    ? Object.entries(dash.by_status).map(([name, value]) => ({
        name: STATUS_LABELS[name] ?? name,
        value: value as number,
        fill: STATUS_COLORS[name] ?? "#64748b",
      }))
    : [];

  const topRisk = ((teamRisk ?? []) as Array<{
    player_id: number; player_name: string; risk_score: number; risk_level: string;
  }>).slice(0, 5);

  const monthData = injuryStats?.by_month
    ? Object.entries(injuryStats.by_month).slice(-6).map(([k, v]) => ({
        month: k.slice(5),
        injuries: v as number,
      }))
    : [];

  const availRate  = dash?.availability_rate ?? 0;
  const availColor = availRate >= 80 ? "#22C55E" : availRate >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen general del equipo"
        action={
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
            style={{
              color: "var(--brand)",
              background: "rgba(79,142,247,0.08)",
              borderColor: "rgba(79,142,247,0.2)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--brand)" }}
            />
            En tiempo real
          </span>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hero: Disponibilidad */}
        <Card variant="highlight" className="sm:col-span-2 flex items-center gap-5">
          <div
            className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${availColor}20 0%, ${availColor}08 100%)`,
              border: `1px solid ${availColor}30`,
              boxShadow: `0 0 16px ${availColor}20`,
            }}
          >
            <ShieldCheck className="w-7 h-7" style={{ color: availColor }} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Disponibilidad del plantel
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">{availRate.toFixed(1)}%</span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {dash?.available ?? 0} / {dash?.total_players ?? 0} jugadores
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${availRate}%`, background: `linear-gradient(90deg, ${availColor}, ${availColor}99)` }}
              />
            </div>
          </div>
        </Card>

        <StatCard label="Lesiones activas"  value={dash?.active_injuries ?? 0} icon={AlertTriangle} color="#EF4444" />
        <StatCard label="Partidos (30d)"    value={dash?.recent_matches ?? 0}  icon={Trophy}        color="#F59E0B" />
      </div>

      {/* Charts + Risk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pie estado */}
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
            Estado del plantel
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%" cy="50%"
                innerRadius={38} outerRadius={58}
                dataKey="value" paddingAngle={3} strokeWidth={0}
              >
                {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.fill }} />
                  <span style={{ color: "var(--text-muted)" }}>{item.name}</span>
                </div>
                <span className="font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Tendencia lesiones */}
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
            Tendencia de lesiones (6m)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthData}>
              <defs>
                <linearGradient id="injGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone" dataKey="injuries" name="Lesiones"
                stroke="#EF4444" strokeWidth={2} fill="url(#injGrad)"
                dot={{ fill: "#EF4444", r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Top riesgo */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: "var(--purple)" }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Mayor riesgo de lesión
            </p>
          </div>
          {topRisk.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--text-muted)" }}>
              Sin datos disponibles
            </div>
          ) : (
            <div className="space-y-2.5">
              {topRisk.map((p) => {
                const color = RISK_COLOR[p.risk_level] ?? "#64748b";
                return (
                  <Link key={p.player_id} href={`/players/${p.player_id}`}>
                    <div
                      className="flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer"
                      style={{ background: "rgba(255,255,255,0.02)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    >
                      {/* Initials avatar */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                        style={{ background: `${color}15`, border: `1px solid ${color}28`, color }}
                      >
                        {p.player_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 truncate">{p.player_name}</p>
                        <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${p.risk_score}%`, background: color }}
                          />
                        </div>
                      </div>
                      <Badge variant="risk" value={p.risk_level} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total jugadores"   value={dash?.total_players ?? 0}              icon={Users}      color="#4F8EF7" />
        <StatCard label="En recuperación"   value={dash?.recovering ?? 0}                 icon={HeartPulse} color="#F97316" />
        <StatCard label="Suspendidos"        value={dash?.suspended ?? 0}                  icon={AlertTriangle} color="#F59E0B" />
        <StatCard label="Días prom. de baja" value={injuryStats?.avg_days_out ?? 0}        icon={Target}     color="#A855F7" />
      </div>
    </div>
  );
}
