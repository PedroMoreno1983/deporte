// lib/lupi.ts — Lupi (Data Humanism) design helpers, encoding maps & types.
// Ported from the redesign prototype (lib.jsx / viz.jsx). Pure, no React.

export type LupiPos = "GK" | "DEF" | "MID" | "ATK";
export type LupiStatus = "available" | "recovering" | "injured" | "suspended" | "inactive";
export type LupiRiskLevel = "low" | "medium" | "high" | "critical";
export type LupiRegion =
  | "rodilla" | "isquio" | "tobillo" | "muslo" | "gemelo" | "espalda" | "pubis";
export type MatchResult = "W" | "D" | "L";

/** A player reduced to the dimensions the Lupi glyphs encode. */
export interface LupiPlayer {
  id: number;
  name: string;
  pos: LupiPos;
  status: LupiStatus;
  minutes: number;
  age: number;
  risk: number;          // 0..100
  riskLevel: LupiRiskLevel;
  body?: string | null;  // sensitive body zone, if any
}

export interface LupiInjury {
  month: string;
  region: LupiRegion;
  severity: number;      // 1..3
  days: number;
  player: string;
}

export interface LupiInjuryMonth {
  month: string;
  items: LupiInjury[];
}

export interface LupiWellnessDay {
  day: string;
  sleep: number;     // 1..5
  mood: number;
  soreness: number;
  load: number;
}

export interface LupiWellPlayer {
  id: number;
  name: string;
  pos: LupiPos;
  sleep: number;
  mood: number;
  soreness: number;
  load: number;
}

export interface LupiMatch {
  id: number;
  opp: string;
  date: string;
  home: boolean;
  gf: number | null;
  ga: number | null;
  result: MatchResult | null;
  played: boolean;
  comp?: string;
  scorers?: string[];
}

export interface LupiDashboard {
  total: number;
  available: number;
  availabilityRate: number;
  activeInjuries: number;
  recovering: number;
  suspended: number;
  recentMatches: number;
  avgDaysOut: number;
}

// ── Encoding maps (CSS variable references, theme-aware) ──────────────────────
export const POS_COLOR: Record<LupiPos, string> = {
  GK: "var(--ochre)",
  DEF: "var(--slate)",
  MID: "var(--pine)",
  ATK: "var(--terracotta)",
};

export const STATUS_COLOR: Record<LupiStatus, string> = {
  available: "var(--pine)",
  recovering: "var(--ochre)",
  injured: "var(--terracotta)",
  suspended: "var(--plum)",
  inactive: "var(--ink-faint)",
};

export const RISK_COLOR: Record<LupiRiskLevel, string> = {
  low: "var(--pine)",
  medium: "var(--ochre)",
  high: "var(--burnt)",
  critical: "var(--terracotta)",
};

export const REGION_COLOR: Record<string, string> = {
  rodilla: "var(--terracotta)",
  isquio: "var(--plum)",
  tobillo: "var(--ochre)",
  muslo: "var(--slate)",
  gemelo: "var(--pine)",
  espalda: "var(--olive)",
  pubis: "var(--ink-soft)",
};

// ── Labels (Spanish) ──────────────────────────────────────────────────────────
export const POS_LABEL: Record<LupiPos, string> = {
  GK: "Arquero",
  DEF: "Defensa",
  MID: "Mediocampo",
  ATK: "Delantero",
};

export const STATUS_LABEL: Record<LupiStatus, string> = {
  available: "Disponible",
  recovering: "Recuperación",
  injured: "Lesionado",
  suspended: "Suspendido",
  inactive: "Inactivo",
};

export const RISK_LABEL: Record<LupiRiskLevel, string> = {
  low: "bajo",
  medium: "medio",
  high: "alto",
  critical: "crítico",
};

// ── Geometry helpers ──────────────────────────────────────────────────────────
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/** minutes → glyph radius (matches prototype scaling). */
export function minToR(min: number, lo = 6.5, hi = 15): number {
  const t = Math.max(0, Math.min(1, (min - 150) / (2650 - 150)));
  return lo + t * (hi - lo);
}

export function riskLevel(r: number): LupiRiskLevel {
  if (r >= 70) return "critical";
  if (r >= 50) return "high";
  if (r >= 30) return "medium";
  return "low";
}
