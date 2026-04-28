"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { injuriesApi, analyticsApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertTriangle, Activity, Calendar, Clock, Zap } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import Link from "next/link";
import { SEVERITY_CONFIG } from "@/lib/design-system";

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs bg-surface-2 border border-white/[0.08]">
      <p className="font-medium text-white/60">{payload[0]?.name}</p>
      <p className="font-bold text-red-400">{payload[0]?.value}</p>
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
        name: SEVERITY_CONFIG[k]?.label ?? k,
        value: v as number,
        key: k,
        color: SEVERITY_CONFIG[k]?.color ?? "#64748b",
      }))
    : [];

  const monthData = injuryStats?.by_month
    ? Object.entries(injuryStats.by_month).slice(-6).map(([k, v]) => ({ month: k.slice(5), count: v as number }))
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lesiones"
        subtitle={`${injuryStats?.active ?? 0} activas · ${injuryStats?.total ?? 0} históricas`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Lesiones activas" value={injuryStats?.active ?? 0} icon={Zap} color="#ef4444" />
        <StatCard label="Total históricas" value={injuryStats?.total ?? 0} icon={Activity} color="#94a3b8" />
        <StatCard label="Días promedio de baja" value={injuryStats?.avg_days_out?.toFixed(0) ?? 0} icon={Clock} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Por severidad</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={severityData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3} strokeWidth={0}>
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {severityData.map((item) => (
              <div key={item.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                  <span className="text-white/40">{item.name}</span>
                </div>
                <span className="font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Tendencia mensual (6m)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-white">Lesiones activas</h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
            {activeInjuries?.length ?? 0} jugadores fuera
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-white/30">
            <Activity className="w-5 h-5 mx-auto mb-2 animate-pulse text-emerald-400" />
            Cargando lesiones...
          </div>
        ) : activeInjuries?.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-4 rounded-xl mb-4 bg-emerald-500/5 border border-emerald-500/10">
              <Activity className="w-7 h-7 text-emerald-400 opacity-50" />
            </div>
            <p className="font-semibold text-white/50">Sin lesiones activas</p>
            <p className="text-xs text-white/30 mt-1">El plantel está en óptimas condiciones</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {activeInjuries?.map((inj: any, i: number) => {
              const sev = SEVERITY_CONFIG[inj.severity];
              const color = sev?.color ?? "#64748b";
              return (
                <motion.div
                  key={inj.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-1.5 self-stretch rounded-full shrink-0 mt-0.5" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link href={`/players/${inj.player_id}`}>
                        <span className="text-sm font-bold text-white/90 hover:text-white transition-colors cursor-pointer">
                          {inj.player_name ?? `Jugador #${inj.player_id}`}
                        </span>
                      </Link>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color, background: `${color}10`, borderColor: `${color}25` }}>
                        {sev?.label ?? inj.severity}
                      </span>
                    </div>
                    <p className="text-sm text-white/60">{inj.injury_type}</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {inj.body_zone.replace(/_/g, " ")}
                      {inj.treatment && ` · ${inj.treatment}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-white/30 mb-1">
                      <Calendar className="w-3 h-3" /> {inj.injury_date}
                    </div>
                    {inj.estimated_days_out && (
                      <div className="flex items-center gap-1 text-xs font-bold justify-end" style={{ color }}>
                        <Clock className="w-3 h-3" /> {inj.estimated_days_out}d
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
