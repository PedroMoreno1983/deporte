"use client";
import { motion } from "framer-motion";
import { TrendingUp, Trophy, Minus, TrendingDown } from "lucide-react";

interface Benchmark {
  metric:     string;
  label:      string;
  value:      number;
  peer_avg:   number;
  percentile: number;
  level:      string;
  peer_count: number;
}

interface PlayerBenchmarksProps {
  data: { benchmarks: Benchmark[]; position?: string } | undefined;
}

function levelTone(p: number): { color: string; Icon: typeof Trophy } {
  if (p >= 90) return { color: "#00ff87", Icon: Trophy };
  if (p >= 75) return { color: "#00ff87", Icon: TrendingUp };
  if (p >= 50) return { color: "#f59e0b", Icon: TrendingUp };
  if (p >= 25) return { color: "#f97316", Icon: Minus };
  return { color: "#ff3b30", Icon: TrendingDown };
}

/**
 * League percentile benchmarks for a player vs same-position peers.
 * Shows: metric value, peer avg, percentile bar, qualitative label.
 */
export function PlayerBenchmarks({ data }: PlayerBenchmarksProps) {
  if (!data || !data.benchmarks?.length) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Sin datos suficientes para comparar contra la liga.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {data.benchmarks.map((b, i) => {
        const { color, Icon } = levelTone(b.percentile);
        const diff = b.value - b.peer_avg;
        const diffPct = b.peer_avg > 0 ? (diff / b.peer_avg) * 100 : 0;
        return (
          <motion.div
            key={b.metric}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl p-3"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white/85">{b.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  vs {b.peer_count} jugador{b.peer_count === 1 ? "" : "es"} en la misma posición
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-black text-lg tabular-nums" style={{ color }}>
                  {b.value.toFixed(2)}
                </p>
                <p className="text-[10px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                  prom {b.peer_avg.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Percentile bar */}
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, b.percentile)}%` }}
                transition={{ duration: 0.7, delay: i * 0.04 + 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                  boxShadow: `0 0 8px ${color}80`,
                }}
              />
              {/* 50% baseline marker */}
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ left: "50%", background: "rgba(255,255,255,0.20)" }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
                <Icon className="w-3.5 h-3.5" />
                {b.level}
              </div>
              <div className="text-[10px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                P{b.percentile.toFixed(0)} ·{" "}
                <span style={{ color: diff > 0 ? "#00ff87" : diff < 0 ? "#ff3b30" : "var(--text-muted)" }}>
                  {diff > 0 ? "+" : ""}
                  {diffPct.toFixed(0)}%
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
