"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, predictionsApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import {
  Users, AlertTriangle, Trophy, ShieldCheck,
  HeartPulse, Target, Zap
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";
import Link from "next/link";

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
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="skeleton h-64 md:col-span-2 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const statusData = dash?.by_status
    ? Object.entries(dash.by_status).map(([name, value]) => ({
        name: ({ available: "Disponible", injured: "Lesionado", recovering: "Recuperación", suspended: "Suspendido", inactive: "Inactivo" } as Record<string, string>)[name] ?? name,
        value: value as number,
        fill: ({ available: "#10b981", injured: "#ef4444", recovering: "#f97316", suspended: "#f59e0b", inactive: "#64748b" } as Record<string, string>)[name] ?? "#64748b",
      }))
    : [];

  const topRisk = ((teamRisk ?? []) as Array<{ player_id: number; player_name: string; risk_score: number; risk_level: string }>).slice(0, 5);

  const monthData = injuryStats?.by_month
    ? Object.entries(injuryStats.by_month).slice(-6).map(([k, v]) => ({ month: k.slice(5), injuries: v as number }))
    : [];

  const availRate = dash?.availability_rate ?? 0;
  const availColor = availRate >= 80 ? "#10b981" : availRate >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen general del equipo"
        action={
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            En tiempo real
          </span>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="highlight" className="sm:col-span-2 flex items-center gap-5">
          <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${availColor}14`, color: availColor }}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">Disponibilidad del plantel</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{availRate.toFixed(1)}%</span>
              <span className="text-sm text-white/40">{dash?.available ?? 0} / {dash?.total_players ?? 0} jugadores</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${availRate}%`, backgroundColor: availColor }} />
            </div>
          </div>
        </Card>

        <StatCard label="Lesiones activas" value={dash?.active_injuries ?? 0} icon={AlertTriangle} color="#ef4444" />
        <StatCard label="Partidos (30d)" value={dash?.recent_matches ?? 0} icon={Trophy} color="#f59e0b" />
      </div>

      {/* Charts + Risk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Estado del plantel</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" paddingAngle={3} strokeWidth={0}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px" }}
                itemStyle={{ color: "#fff" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.fill }} />
                  <span className="text-white/60">{item.name}</span>
                </div>
                <span className="font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Tendencia de lesiones (6m)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthData}>
              <defs>
                <linearGradient id="injGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px" }}
                itemStyle={{ color: "#ef4444" }}
              />
              <Area type="monotone" dataKey="injuries" stroke="#ef4444" strokeWidth={2} fill="url(#injGrad)" dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-purple-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Mayor riesgo de lesión</p>
          </div>
          {topRisk.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-white/30">Sin datos disponibles</div>
          ) : (
            <div className="space-y-3">
              {topRisk.map((p) => (
                <Link key={p.player_id} href={`/players/${p.player_id}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/80 truncate">{p.player_name}</p>
                      <div className="h-1.5 rounded-full mt-2 bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.risk_score}%`, backgroundColor: getRiskConfig(p.risk_level).color }} />
                      </div>
                    </div>
                    <Badge variant="risk" value={p.risk_level} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total jugadores" value={dash?.total_players ?? 0} icon={Users} color="#0ea5e9" />
        <StatCard label="En recuperación" value={dash?.recovering ?? 0} icon={HeartPulse} color="#f97316" />
        <StatCard label="Suspendidos" value={dash?.suspended ?? 0} icon={AlertTriangle} color="#f59e0b" />
        <StatCard label="Días prom. de baja" value={injuryStats?.avg_days_out ?? 0} icon={Target} color="#a855f7" />
      </div>
    </div>
  );
}

function getRiskConfig(level: string) {
  const map: Record<string, { color: string; label: string }> = {
    low: { color: "#10b981", label: "Bajo" },
    medium: { color: "#f59e0b", label: "Moderado" },
    high: { color: "#f97316", label: "Alto" },
    critical: { color: "#ef4444", label: "Crítico" },
  };
  return map[level] ?? { color: "#64748b", label: "—" };
}
