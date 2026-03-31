"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { analyticsApi, categoriesApi, playersApi, matchesApi } from "@/lib/api";
import { BarChart3, TrendingUp, Users, Target } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, ScatterChart, Scatter, ZAxis, Cell
} from "recharts";
import { POSITION_LABELS } from "@/lib/utils";

export default function AnalyticsPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();

  const { data: dash } = useQuery({
    queryKey: ["dashboard", selectedCategory],
    queryFn: () => analyticsApi.dashboard(selectedCategory),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: injuryStats } = useQuery({
    queryKey: ["injury-stats"],
    queryFn: () => analyticsApi.injuryStats(),
  });

  const { data: players } = useQuery({
    queryKey: ["players"],
    queryFn: () => playersApi.list(),
  });

  // Players by position
  const byPosition = players?.reduce((acc: Record<string, number>, p: { position: string }) => {
    acc[p.position] = (acc[p.position] || 0) + 1;
    return acc;
  }, {}) ?? {};
  const positionData = Object.entries(byPosition)
    .map(([pos, count]) => ({ position: POSITION_LABELS[pos] || pos, count: count as number }))
    .sort((a, b) => b.count - a.count);

  // Injury by mechanism
  const mechData = injuryStats?.by_mechanism
    ? Object.entries(injuryStats.by_mechanism).map(([k, v]) => ({
        name: k === "contact" ? "Contacto" : k === "non_contact" ? "Sin contacto" : k === "overload" ? "Sobrecarga" : "Relesión",
        value: v as number
      }))
    : [];

  const monthData = injuryStats?.by_month
    ? Object.entries(injuryStats.by_month).map(([k, v]) => ({ month: k, injuries: v as number }))
    : [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-muted-foreground text-sm">Indicadores y tendencias del equipo</p>
          </div>
        </div>
        <select
          value={selectedCategory ?? ""}
          onChange={e => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="">Todas las categorías</option>
          {categories?.map((c: { id: number; name: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Jugadores totales", value: dash?.total_players ?? 0, color: "text-blue-400", bg: "bg-blue-400/10" },
          { icon: Target, label: "Tasa disponibilidad", value: `${dash?.availability_rate ?? 0}%`, color: "text-emerald-400", bg: "bg-emerald-400/10" },
          { icon: TrendingUp, label: "Rating promedio", value: dash?.avg_team_rating ? `${dash.avg_team_rating}/10` : "-", color: "text-yellow-400", bg: "bg-yellow-400/10" },
          { icon: BarChart3, label: "Partidos (30 días)", value: dash?.recent_matches ?? 0, color: "text-purple-400", bg: "bg-purple-400/10" },
        ].map(({ icon: Icon, label, value, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="glass rounded-xl p-5"
          >
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Players by position */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold mb-4">Jugadores por posición</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={positionData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
              <YAxis type="category" dataKey="position" tick={{ fontSize: 9 }} width={90} stroke="rgba(255,255,255,0.2)" />
              <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Injury by mechanism */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold mb-4">Lesiones por mecanismo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mechData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
              <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
              <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {mechData.map((_, i) => (
                  <Cell key={i} fill={["#ef4444", "#f97316", "#f59e0b", "#a855f7"][i % 4]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Lesiones por mes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass rounded-xl p-5 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Lesiones por mes</h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Total: <strong className="text-foreground">{injuryStats?.total ?? 0}</strong></span>
              <span>Promedio baja: <strong className="text-foreground">{injuryStats?.avg_days_out?.toFixed(0) ?? "-"} días</strong></span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
              <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
              <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="injuries" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} name="Lesiones" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
