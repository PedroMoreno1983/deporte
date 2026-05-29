"use client";
import { motion } from "framer-motion";
import { Info, AlertTriangle, TrendingUp } from "lucide-react";

export interface RiskFactor {
  label?: string;
  value?: number | string | null;
  contribution: number;
  description?: string;
}

interface RiskExplanationProps {
  score: number;            // 0..100
  level: "low" | "medium" | "high" | "critical";
  factors: Record<string, RiskFactor>;
  /** Total possible to compare relative contributions (defaults to 100) */
  maxScore?: number;
}

const LEVEL = {
  low:      { color: "#00ff87", label: "Bajo"     },
  medium:   { color: "#f59e0b", label: "Moderado" },
  high:     { color: "#f97316", label: "Alto"     },
  critical: { color: "#ff3b30", label: "Crítico"  },
};

/** Color a contribution value: green (small) → amber → red (large). */
function contributionColor(c: number, max: number): string {
  const ratio = Math.max(0, Math.min(1, c / max));
  if (ratio < 0.15) return "#00ff87";
  if (ratio < 0.30) return "#f59e0b";
  if (ratio < 0.50) return "#f97316";
  return "#ff3b30";
}

/**
 * Branded "explainable AI" panel showing per-factor contributions to the
 * overall injury-risk score (akin to a SHAP waterfall).
 * Inputs come straight from `injury_risk_factors` in the prediction API.
 */
export function RiskExplanation({
  score, level, factors, maxScore = 100,
}: RiskExplanationProps) {
  const lvl = LEVEL[level] ?? LEVEL.low;
  // Order factors by contribution desc; skip the ones with zero impact at the end
  const ordered = Object.entries(factors)
    .map(([key, f]) => ({ key, ...f }))
    .sort((a, b) => b.contribution - a.contribution);

  const totalContribution = ordered.reduce((sum, f) => sum + (f.contribution ?? 0), 0);
  const maxContribution = Math.max(...ordered.map((f) => f.contribution ?? 0), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: `${lvl.color}18`,
              border: `1px solid ${lvl.color}40`,
              boxShadow: `0 0 18px ${lvl.color}30`,
            }}
          >
            <AlertTriangle className="w-5 h-5" style={{ color: lvl.color }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              ¿Por qué este score?
            </p>
            <p className="text-sm text-white/85 font-semibold">
              Desglose del riesgo predicho
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="font-mono font-black tabular-nums leading-none"
            style={{ fontSize: 36, color: lvl.color, letterSpacing: "-0.04em" }}
          >
            {Math.round(score)}
          </p>
          <p
            className="text-xs font-bold uppercase tracking-wider mt-1"
            style={{ color: lvl.color }}
          >
            {lvl.label}
          </p>
        </div>
      </div>

      {/* Waterfall */}
      <div className="space-y-3">
        {ordered.map((f, i) => {
          const color = contributionColor(f.contribution, maxContribution);
          const pct = (f.contribution / maxContribution) * 100;
          const sharePct = totalContribution > 0
            ? (f.contribution / totalContribution) * 100
            : 0;
          return (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.3 }}
              className="rounded-xl p-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-white/85 truncate">
                    {f.label ?? f.key}
                  </span>
                  {f.value != null && (
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded tabular-nums"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.55)",
                      }}
                    >
                      {f.value}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span
                    className="font-mono font-black text-sm tabular-nums"
                    style={{ color }}
                  >
                    {f.contribution > 0 ? "+" : ""}
                    {f.contribution.toFixed(0)}
                  </span>
                  {totalContribution > 0 && (
                    <span className="text-[10px] font-mono text-white/30 tabular-nums">
                      ({sharePct.toFixed(0)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.05 * i + 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full"
                  style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
                />
              </div>
              {f.description && (
                <p
                  className="text-xs mt-2 leading-relaxed flex items-start gap-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{f.description}</span>
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <div
        className="flex items-center justify-between gap-3 pt-2 text-xs"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: lvl.color }} />
          <span className="font-bold" style={{ color: "var(--text-secondary)" }}>
            {ordered.length} factores evaluados
          </span>
        </div>
        <span className="font-mono text-white/35 tabular-nums">
          Suma: {totalContribution.toFixed(0)} / {maxScore}
        </span>
      </div>
    </div>
  );
}
