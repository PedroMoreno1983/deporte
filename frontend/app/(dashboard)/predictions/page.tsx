"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { predictionsApi } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { PageHeader } from "@/components/ui/PageHeader";
import { Brain, Shield, AlertTriangle, TrendingUp, Activity, Zap } from "lucide-react";
import Link from "next/link";

const RISK_COLOR: Record<string, string> = {
  low: "#00ff87", medium: "#f59e0b", high: "#f97316", critical: "#ff3b30",
};
const RISK_BG: Record<string, string> = {
  low: "rgba(0,255,135,0.08)", medium: "rgba(245,158,11,0.08)",
  high: "rgba(249,115,22,0.08)", critical: "rgba(255,59,48,0.08)",
};
const RISK_BORDER: Record<string, string> = {
  low: "rgba(0,255,135,0.2)", medium: "rgba(245,158,11,0.2)",
  high: "rgba(249,115,22,0.25)", critical: "rgba(255,59,48,0.3)",
};
const RISK_LABEL: Record<string, string> = {
  low: "Riesgo bajo", medium: "Riesgo medio", high: "Riesgo alto", critical: "Riesgo crítico",
};

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] as any },
});

export default function PredictionsPage() {
  const { data: teamRisk, isLoading } = useQuery({
    queryKey: ["team-risk"],
    queryFn: () => predictionsApi.teamRisk(),
  });

  const levels = ["low", "medium", "high", "critical"];
  const levelCounts = levels.reduce((acc, l) => {
    acc[l] = teamRisk?.filter((p: { risk_level: string }) => p.risk_level === l).length ?? 0;
    return acc;
  }, {} as Record<string, number>);

  const criticalAndHigh = teamRisk?.filter(
    (p: { risk_level: string }) => p.risk_level === "critical" || p.risk_level === "high"
  ) ?? [];

  const allPlayers = teamRisk ?? [];

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* ── Background sci-fi grid */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: "linear-gradient(rgba(0,255,135,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,135,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 space-y-5">
        {/* Header */}
        <PageHeader
          icon={Brain}
          title="Predicciones ML"
          description="Modelos de riesgo de lesión y proyección de rendimiento"
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
        />

        {/* Level summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {levels.map((level, i) => {
            const color = RISK_COLOR[level];
            const LevelIcon = level === "critical" ? Zap : level === "high" ? AlertTriangle : level === "medium" ? TrendingUp : Shield;
            return (
              <motion.div key={level} {...stagger(i)}>
                <GlowCard className="p-5 rounded-2xl" style={{
                  border: `1px solid ${RISK_BORDER[level]}`,
                  background: RISK_BG[level],
                }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                      <LevelIcon className="w-4 h-4" style={{ color }} />
                    </div>
                    {level === "critical" && levelCounts[level] > 0 && (
                      <div className="status-dot" style={{ width: 6, height: 6, background: color }} />
                    )}
                  </div>
                  <AnimatedCounter value={levelCounts[level]} className="text-4xl font-black" style={{ color } as any} />
                  <p className="text-xs mt-1 font-semibold" style={{ color }}>{RISK_LABEL[level]}</p>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>

        {/* Critical / High alert + Gauge grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Alert panel */}
          <motion.div {...stagger(4)}>
            <GlowCard className="p-5 rounded-2xl h-full" style={{ border: "1px solid rgba(255,59,48,0.15)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg" style={{ background: "rgba(255,59,48,0.1)" }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: "var(--danger)" }} />
                </div>
                <h3 className="text-sm font-bold">Jugadores en alerta</h3>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: "var(--danger)", background: "rgba(255,59,48,0.1)" }}>
                  {criticalAndHigh.length} jugadores
                </span>
              </div>

              {criticalAndHigh.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="inline-flex p-4 rounded-2xl mb-3"
                    style={{ background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.15)" }}>
                    <Shield className="w-6 h-6" style={{ color: "var(--neon)" }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Sin jugadores en riesgo alto
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {criticalAndHigh.map((p: {
                    player_id: number; player_name: string; risk_score: number; risk_level: string;
                  }, i: number) => {
                    const color = RISK_COLOR[p.risk_level];
                    return (
                      <motion.div
                        key={p.player_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.05 }}
                      >
                        <Link href={`/players/${p.player_id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer"
                            style={{ background: `${color}08`, border: `1px solid ${color}25` }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = `${color}14`)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = `${color}08`)}
                          >
                            {/* Mini gauge */}
                            <div className="shrink-0">
                              <RiskGauge score={p.risk_score} level={p.risk_level as any} size={52} showLabel={false} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white/90 truncate">{p.player_name}</p>
                              <p className="text-xs font-semibold mt-0.5" style={{ color }}>{RISK_LABEL[p.risk_level]}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-2xl font-black font-mono" style={{ color }}>{p.risk_score}</p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>/ 100</p>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </GlowCard>
          </motion.div>

          {/* Top 6 gauge grid */}
          <motion.div {...stagger(5)}>
            <GlowCard className="p-5 rounded-2xl h-full">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                Top riesgo — mayor a menor
              </p>
              {isLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton rounded-xl" style={{ height: 100 }} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {allPlayers.slice(0, 6).map((p: {
                    player_id: number; player_name: string; risk_score: number; risk_level: string;
                  }, i: number) => (
                    <motion.div
                      key={p.player_id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.07 }}
                    >
                      <Link href={`/players/${p.player_id}`}>
                        <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer transition-all"
                          style={{ background: "rgba(255,255,255,0.02)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        >
                          <RiskGauge score={p.risk_score} level={p.risk_level as any} size={72} showLabel={false} />
                          <p className="text-[10px] font-semibold text-center text-white/60 leading-tight truncate w-full text-center">
                            {p.player_name.split(" ")[1] ?? p.player_name}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlowCard>
          </motion.div>
        </div>

        {/* Full ranking table */}
        <motion.div {...stagger(6)}>
          <GlowCard className="rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: "rgba(168,85,247,0.1)" }}>
                  <Brain className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="text-sm font-bold">Ranking completo de riesgo</h3>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {allPlayers.length} jugadores evaluados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.01)" }}>
                    {["#", "Jugador", "Score de riesgo", "Nivel"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <td key={j} className="px-5 py-3">
                            <div className="skeleton h-4 rounded" style={{ width: j === 1 ? 120 : j === 2 ? 80 : 40 }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : allPlayers.map((p: {
                    player_id: number; player_name: string; risk_score: number; risk_level: string;
                  }, i: number) => {
                    const color = RISK_COLOR[p.risk_level];
                    return (
                      <motion.tr
                        key={p.player_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 + i * 0.02 }}
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        className="transition-colors cursor-pointer"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/players/${p.player_id}`} className="font-semibold text-white/80 hover:text-white transition-colors">
                            {p.player_name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[120px]"
                              style={{ background: "rgba(255,255,255,0.06)" }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${p.risk_score}%` }}
                                transition={{ delay: 0.7 + i * 0.02, duration: 0.6 }}
                                className="h-full rounded-full"
                                style={{ background: color, boxShadow: `0 0 6px ${color}50` }}
                              />
                            </div>
                            <span className="text-xs font-bold font-mono w-8" style={{ color }}>{p.risk_score}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ color, background: `${color}12`, border: `1px solid ${color}25` }}>
                            {RISK_LABEL[p.risk_level]}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlowCard>
        </motion.div>
      </div>
    </div>
  );
}
