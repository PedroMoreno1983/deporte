"use client";
/**
 * Pitch heatmap: renders a football pitch with a heat overlay built from
 * (x, y, intensity) points. Coordinates are 0..100 (left→right, top→bottom).
 *
 * If no points are provided, a synthetic distribution is generated around the
 * player's typical zone so the UI still demonstrates value before real
 * tracking data is wired up by the backend.
 *
 * Heat is rendered as SVG circles with radial gradients and additive blur
 * — performance is fine up to a few hundred points.
 */
import { useMemo } from "react";

export interface HeatPoint {
  x: number;       // 0..100
  y: number;       // 0..100
  intensity?: number; // 0..1, defaults 0.6
}

interface PitchHeatmapProps {
  points?: HeatPoint[];
  /** Position code (goalkeeper, center_back, ...) — drives synthetic data */
  playerPosition?: string;
  /** Number of synthetic points if none provided */
  syntheticCount?: number;
  /** Width in px (height is derived to keep pitch ratio) */
  width?: number;
  className?: string;
  /** Hide pitch lines (useful for compact overlays) */
  bare?: boolean;
  /** Direction the team attacks: "up" puts higher Y near top (attack-up) */
  attackDirection?: "up" | "down";
}

// ── Zone centroids by position (x, y, spread) ────────────────────────────
const POSITION_ZONES: Record<string, { cx: number; cy: number; sx: number; sy: number }> = {
  goalkeeper:     { cx: 50, cy: 92, sx: 8,  sy: 4  },
  center_back:    { cx: 50, cy: 78, sx: 14, sy: 6  },
  left_back:      { cx: 18, cy: 70, sx: 12, sy: 14 },
  right_back:     { cx: 82, cy: 70, sx: 12, sy: 14 },
  defensive_mid:  { cx: 50, cy: 60, sx: 16, sy: 10 },
  central_mid:    { cx: 50, cy: 48, sx: 18, sy: 16 },
  attacking_mid:  { cx: 50, cy: 35, sx: 18, sy: 14 },
  left_wing:      { cx: 20, cy: 30, sx: 14, sy: 18 },
  right_wing:     { cx: 80, cy: 30, sx: 14, sy: 18 },
  center_forward: { cx: 50, cy: 18, sx: 18, sy: 12 },
};

function gaussian() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateSynthetic(position: string | undefined, count: number, seed: number): HeatPoint[] {
  const zone = POSITION_ZONES[position ?? ""] ?? POSITION_ZONES.central_mid;
  // Simple seeded rng for stable visuals across renders
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out: HeatPoint[] = [];
  for (let i = 0; i < count; i++) {
    const gx = gaussian() * zone.sx * 0.6;
    const gy = gaussian() * zone.sy * 0.6;
    const x = Math.max(2, Math.min(98, zone.cx + gx));
    const y = Math.max(2, Math.min(98, zone.cy + gy));
    out.push({ x, y, intensity: 0.35 + rand() * 0.65 });
  }
  return out;
}

export function PitchHeatmap({
  points,
  playerPosition,
  syntheticCount = 60,
  width = 480,
  className,
  bare = false,
  attackDirection = "up",
}: PitchHeatmapProps) {
  // Pitch ratio: 105m x 68m → portrait ratio 68/105 ≈ 0.648
  const height = Math.round(width / 0.648);

  // Seed comes from position + count so synthetic data is stable per render
  const seed = useMemo(
    () => ((playerPosition ?? "x").length * 31 + syntheticCount) % 9999,
    [playerPosition, syntheticCount],
  );

  const data = useMemo<HeatPoint[]>(() => {
    if (points && points.length > 0) return points;
    return generateSynthetic(playerPosition, syntheticCount, seed);
  }, [points, playerPosition, syntheticCount, seed]);

  // Flip Y for attack direction
  const oriented = useMemo(
    () =>
      attackDirection === "up"
        ? data
        : data.map((p) => ({ ...p, y: 100 - p.y })),
    [data, attackDirection],
  );

  const isSynthetic = !points || points.length === 0;

  return (
    <div className={className} style={{ width, position: "relative" }}>
      <svg
        viewBox="0 0 100 154"
        width={width}
        height={height}
        style={{ display: "block" }}
      >
        <defs>
          {/* Heat gradient: green (low) → amber → red (high) */}
          <radialGradient id="heat" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#ff3b30" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.55" />
            <stop offset="75%" stopColor="#c0432b" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#c0432b" stopOpacity="0" />
          </radialGradient>
          <filter id="heatBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <linearGradient id="pitchBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#06121d" />
            <stop offset="100%" stopColor="#020817" />
          </linearGradient>
        </defs>

        {/* Pitch background */}
        <rect x="0" y="0" width="100" height="154" fill="url(#pitchBg)" />

        {/* Subtle stripe overlay (turf mow lines) */}
        {!bare && (
          <g opacity="0.35">
            {Array.from({ length: 8 }).map((_, i) => (
              <rect
                key={i}
                x="0"
                y={i * (154 / 8)}
                width="100"
                height={154 / 8}
                fill={i % 2 === 0 ? "rgba(192,67,43,0.025)" : "rgba(192,67,43,0.012)"}
              />
            ))}
          </g>
        )}

        {/* Pitch lines */}
        {!bare && (
          <g
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="0.3"
          >
            {/* Outer pitch */}
            <rect x="3" y="3" width="94" height="148" />
            {/* Center line */}
            <line x1="3" y1="77" x2="97" y2="77" />
            {/* Center circle */}
            <circle cx="50" cy="77" r="9.15" />
            <circle cx="50" cy="77" r="0.6" fill="rgba(192,67,43,0.6)" stroke="none" />
            {/* Penalty boxes */}
            <rect x="22" y="3"   width="56" height="16.5" />
            <rect x="22" y="134.5" width="56" height="16.5" />
            {/* Goal boxes */}
            <rect x="36.5" y="3"   width="27" height="5.5" />
            <rect x="36.5" y="145.5" width="27" height="5.5" />
            {/* Penalty arcs */}
            <path d="M 41 19.5 Q 50 27 59 19.5" />
            <path d="M 41 134.5 Q 50 127 59 134.5" />
            {/* Goals */}
            <line x1="44" y1="3"   x2="56" y2="3"   strokeWidth="0.6" stroke="rgba(192,67,43,0.5)" />
            <line x1="44" y1="151" x2="56" y2="151" strokeWidth="0.6" stroke="rgba(192,67,43,0.5)" />
          </g>
        )}

        {/* Heat layer — additive blending for accumulation feel */}
        <g style={{ mixBlendMode: "screen" as const }} filter="url(#heatBlur)">
          {oriented.map((p, i) => {
            // Note y is 0..100 but viewBox y goes 0..154, so scale:
            const y = (p.y * 154) / 100;
            const r = 8 + (p.intensity ?? 0.6) * 10;
            return (
              <circle
                key={i}
                cx={p.x}
                cy={y}
                r={r}
                fill="url(#heat)"
                opacity={(p.intensity ?? 0.6) * 0.85}
              />
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      {!bare && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 text-[10px] font-mono text-white/50 pointer-events-none">
          <span>Baja</span>
          <div
            className="flex-1 h-1.5 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(192,67,43,0.55), rgba(245,158,11,0.7), rgba(255,59,48,0.9))",
              boxShadow: "0 0 8px rgba(192,67,43,0.25)",
            }}
          />
          <span>Alta</span>
        </div>
      )}

      {isSynthetic && (
        <div
          className="absolute top-2 right-2 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded"
          style={{
            background: "rgba(245,158,11,0.15)",
            color: "#f59e0b",
            border: "1px solid rgba(245,158,11,0.30)",
          }}
          title="Sin datos reales aún — distribución estimada por posición"
        >
          Sintético
        </div>
      )}
    </div>
  );
}
