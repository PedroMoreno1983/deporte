"use client";
// Lupi visual primitives: hand annotations + the player glyph.
import type { CSSProperties } from "react";
import {
  type LupiPlayer, type LupiStatus,
  POS_COLOR, RISK_COLOR, arcPath, minToR,
} from "@/lib/lupi";

// ── Hand annotation: marker-style note ────────────────────────────────────────
export function Note({
  children, style, className = "", rotate = 0, color = "var(--ink-soft)",
}: {
  children: React.ReactNode;
  style?: CSSProperties;
  className?: string;
  rotate?: number;
  color?: string;
}) {
  return (
    <span
      className={"lupi-note " + className}
      style={{
        fontFamily: "var(--hand)",
        color,
        display: "inline-block",
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        lineHeight: 1.15,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ── Curved leader line pointing from a note toward something ──────────────────
export function Leader({ w = 60, h = 24, flip = false, color = "var(--ink-faint)" }) {
  const d = flip
    ? `M ${w - 2} 4 C ${w * 0.5} 2, ${w * 0.35} ${h - 6}, 3 ${h - 3}`
    : `M 2 4 C ${w * 0.5} 2, ${w * 0.65} ${h - 6}, ${w - 3} ${h - 3}`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" filter="url(#wobble)" />
      <circle cx={flip ? 3 : w - 3} cy={flip ? h - 3 : h - 3} r={1.6} fill={color} />
    </svg>
  );
}

// ── PlayerGlyph ───────────────────────────────────────────────────────────────
// color = position · size = minutes · fill treatment = status · outer arc = risk
export function PlayerGlyph({
  p, box = 50, showRisk = true, handDrawn = true,
}: {
  p: LupiPlayer;
  box?: number;
  showRisk?: boolean;
  handDrawn?: boolean;
}) {
  const c = box / 2;
  const r = minToR(p.minutes);
  const col = POS_COLOR[p.pos];
  const filter = handDrawn ? "url(#wobble)" : undefined;
  const riskArcR = r + 5;
  const riskDeg = (p.risk / 100) * 320;
  const clipId = `half-${p.id}`;

  let body: React.ReactNode;
  if (p.status === "available") {
    body = <circle cx={c} cy={c} r={r} fill={col} stroke={col} strokeWidth={1} filter={filter} />;
  } else if (p.status === "recovering") {
    body = (
      <g filter={filter}>
        <clipPath id={clipId}><rect x={c} y={c - r - 1} width={r + 1} height={2 * r + 2} /></clipPath>
        <circle cx={c} cy={c} r={r} fill="none" stroke={col} strokeWidth={1.6} />
        <circle cx={c} cy={c} r={r} fill={col} clipPath={`url(#${clipId})`} />
      </g>
    );
  } else if (p.status === "injured") {
    body = (
      <g filter={filter}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={col} strokeWidth={1.8} />
        <line x1={c - r * 0.5} y1={c - r * 0.5} x2={c + r * 0.5} y2={c + r * 0.5} stroke={col} strokeWidth={1.6} strokeLinecap="round" />
        <line x1={c + r * 0.5} y1={c - r * 0.5} x2={c - r * 0.5} y2={c + r * 0.5} stroke={col} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    );
  } else if (p.status === "suspended") {
    body = (
      <g filter={filter}>
        <circle cx={c} cy={c} r={r} fill={col} opacity={0.85} />
        <rect x={c - 1.1} y={c - r * 0.55} width={2.2} height={r * 1.1} fill="var(--paper-card)" rx={1} />
      </g>
    );
  } else {
    body = <circle cx={c} cy={c} r={r} fill="none" stroke="var(--ink-faint)" strokeWidth={1.4} strokeDasharray="1.5 2.5" opacity={0.6} filter={filter} />;
  }

  return (
    <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} style={{ overflow: "visible" }}>
      {showRisk && p.risk >= 12 && (
        <path d={arcPath(c, c, riskArcR, 0, riskDeg)} fill="none"
          stroke={RISK_COLOR[p.riskLevel]} strokeWidth={1.6} strokeLinecap="round"
          opacity={0.9} filter={handDrawn ? "url(#wobble)" : undefined} />
      )}
      {body}
    </svg>
  );
}

// ── A small standalone mark used in legends ───────────────────────────────────
export function LegendMark({ kind, color, size = 22 }: { kind: LupiStatus; color: string; size?: number }) {
  const c = size / 2, r = size * 0.32;
  const f = "url(#wobble)";
  if (kind === "available") return <svg width={size} height={size}><circle cx={c} cy={c} r={r} fill={color} filter={f} /></svg>;
  if (kind === "recovering") return (
    <svg width={size} height={size}>
      <clipPath id="lh"><rect x={c} y={0} width={size} height={size} /></clipPath>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={1.6} filter={f} />
      <circle cx={c} cy={c} r={r} fill={color} clipPath="url(#lh)" filter={f} />
    </svg>
  );
  if (kind === "injured") return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={1.8} filter={f} />
      <line x1={c - r * 0.5} y1={c - r * 0.5} x2={c + r * 0.5} y2={c + r * 0.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={c + r * 0.5} y1={c - r * 0.5} x2={c - r * 0.5} y2={c + r * 0.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
  if (kind === "suspended") return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill={color} opacity={0.85} filter={f} />
      <rect x={c - 1} y={c - r * 0.55} width={2} height={r * 1.1} fill="var(--paper-card)" rx={1} />
    </svg>
  );
  return <svg width={size} height={size}><circle cx={c} cy={c} r={r} fill="none" stroke="var(--ink-faint)" strokeWidth={1.4} strokeDasharray="1.5 2.5" filter={f} /></svg>;
}
