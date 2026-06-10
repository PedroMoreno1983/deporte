// lib/lupi-adapters.ts — map loosely-typed backend payloads onto the
// strongly-typed shapes the Lupi glyphs expect. Defensive by design: any
// missing field degrades gracefully rather than throwing.
import { POSITION_GROUPS } from "@/lib/design-system";
import {
  type LupiPlayer, type LupiPos, type LupiStatus, type LupiRiskLevel,
  type LupiInjury, type LupiInjuryMonth, type LupiDashboard, type LupiRegion,
  type LupiMatch, type MatchResult,
  riskLevel,
} from "@/lib/lupi";

// ── tiny coercion helpers ─────────────────────────────────────────────────────
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function num(v: unknown, d = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : d;
}
function str(v: unknown, d = ""): string {
  return typeof v === "string" ? v : d;
}

const POS_GROUP_TO_LUPI: Record<string, LupiPos> = { gk: "GK", def: "DEF", mid: "MID", atk: "ATK" };
const STATUSES: LupiStatus[] = ["available", "recovering", "injured", "suspended", "inactive"];

function toPos(position: string): LupiPos {
  const group = POSITION_GROUPS[position];
  if (group) return POS_GROUP_TO_LUPI[group];
  const p = position.toLowerCase();
  if (p.includes("gk") || p.includes("keeper") || p.includes("arquero") || p.includes("portero")) return "GK";
  if (p.includes("def") || p.includes("back")) return "DEF";
  if (p.includes("forward") || p.includes("wing") || p.includes("delan") || p.includes("atk")) return "ATK";
  return "MID";
}

function toStatus(status: string): LupiStatus {
  return (STATUSES as string[]).includes(status) ? (status as LupiStatus) : "inactive";
}

function ageFrom(rec: Record<string, unknown>): number {
  if (typeof rec.age === "number") return rec.age;
  const dob = str(rec.birth_date) || str(rec.date_of_birth);
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function nameFrom(rec: Record<string, unknown>): string {
  const full = `${str(rec.first_name)} ${str(rec.last_name)}`.trim();
  return full || str(rec.name) || str(rec.full_name) || "—";
}

// ── Players ───────────────────────────────────────────────────────────────────
export interface RiskInfo { risk: number; level?: LupiRiskLevel }

/** Build a map player_id → risk from the predictions/team risk payload. */
export function buildRiskMap(teamRisk: unknown): Map<number, RiskInfo> {
  const map = new Map<number, RiskInfo>();
  if (!Array.isArray(teamRisk)) return map;
  for (const raw of teamRisk) {
    const r = asRecord(raw);
    const id = num(r.player_id, NaN);
    if (Number.isNaN(id)) continue;
    const level = str(r.risk_level) as LupiRiskLevel;
    map.set(id, { risk: num(r.risk_score), level: level || undefined });
  }
  return map;
}

export function adaptPlayer(raw: unknown, riskMap?: Map<number, RiskInfo>): LupiPlayer {
  const rec = asRecord(raw);
  const id = num(rec.id);
  const info = riskMap?.get(id);
  const risk = info ? info.risk : num(rec.risk ?? rec.risk_score);
  const minutes = num(rec.minutes ?? rec.season_minutes ?? rec.total_minutes ?? rec.minutes_played);
  const body = str(rec.body_zone ?? rec.sensitive_zone ?? rec.body_region) || null;
  return {
    id,
    name: nameFrom(rec),
    pos: toPos(str(rec.position)),
    status: toStatus(str(rec.status)),
    minutes,
    age: ageFrom(rec),
    risk,
    riskLevel: info?.level ?? riskLevel(risk),
    body,
  };
}

export function adaptRoster(players: unknown, teamRisk?: unknown): LupiPlayer[] {
  if (!Array.isArray(players)) return [];
  const riskMap = teamRisk ? buildRiskMap(teamRisk) : undefined;
  return players.map((p) => adaptPlayer(p, riskMap));
}

// ── Dashboard KPIs (derived from the roster, with optional overrides) ─────────
export function buildDashboard(
  roster: LupiPlayer[],
  extra?: Partial<Pick<LupiDashboard, "recentMatches" | "avgDaysOut">>,
): LupiDashboard {
  const total = roster.length;
  const count = (s: LupiStatus) => roster.filter((p) => p.status === s).length;
  const available = count("available");
  return {
    total,
    available,
    availabilityRate: total ? +((available / total) * 100).toFixed(1) : 0,
    activeInjuries: count("injured"),
    recovering: count("recovering"),
    suspended: count("suspended"),
    recentMatches: extra?.recentMatches ?? 0,
    avgDaysOut: extra?.avgDaysOut ?? 0,
  };
}

// ── Injuries ──────────────────────────────────────────────────────────────────
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const REGION_ALIASES: Record<string, LupiRegion> = {
  knee: "rodilla", rodilla: "rodilla",
  hamstring: "isquio", isquio: "isquio", isquiotibial: "isquio",
  ankle: "tobillo", tobillo: "tobillo",
  thigh: "muslo", muslo: "muslo", quad: "muslo", cuadriceps: "muslo",
  calf: "gemelo", gemelo: "gemelo",
  back: "espalda", espalda: "espalda", lumbar: "espalda",
  groin: "pubis", pubis: "pubis", aductor: "pubis", adductor: "pubis",
};

function normalizeRegion(s: string): LupiRegion {
  const k = s.toLowerCase().trim();
  return REGION_ALIASES[k] ?? "muslo";
}

function severityFrom(rec: Record<string, unknown>): number {
  if (typeof rec.severity === "number") return Math.max(1, Math.min(3, rec.severity));
  const g = str(rec.severity ?? rec.grade);
  const m = g.match(/(\d)/);
  if (m) return Math.max(1, Math.min(3, Number(m[1])));
  return 2;
}

function monthFrom(rec: Record<string, unknown>): string {
  const explicit = str(rec.month);
  if (explicit) return explicit;
  const date = str(rec.date ?? rec.injury_date ?? rec.created_at ?? rec.start_date);
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "—" : MONTHS_ES[d.getMonth()];
}

export function adaptInjury(raw: unknown): LupiInjury {
  const rec = asRecord(raw);
  return {
    month: monthFrom(rec),
    region: normalizeRegion(str(rec.region ?? rec.body_region ?? rec.body_part ?? rec.location)),
    severity: severityFrom(rec),
    days: num(rec.days ?? rec.days_out ?? rec.estimated_days),
    player: str(rec.player_name ?? rec.player ?? rec.name) || nameFrom(asRecord(rec.player)),
  };
}

export function adaptInjuries(injuries: unknown): LupiInjury[] {
  if (!Array.isArray(injuries)) return [];
  return injuries.map(adaptInjury);
}

/** Group injuries into the chronological months present (most recent last). */
export function groupInjuriesByMonth(injuries: LupiInjury[]): LupiInjuryMonth[] {
  const order = new Map<string, number>(MONTHS_ES.map((m, i) => [m, i]));
  const byMonth = new Map<string, LupiInjury[]>();
  for (const inj of injuries) {
    const list = byMonth.get(inj.month) ?? [];
    list.push(inj);
    byMonth.set(inj.month, list);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99))
    .map(([month, items]) => ({ month, items }));
}

export function avgDaysOut(injuries: LupiInjury[]): number {
  if (!injuries.length) return 0;
  return Math.round(injuries.reduce((a, b) => a + b.days, 0) / injuries.length);
}

// ── Matches ───────────────────────────────────────────────────────────────────
function matchResult(gf: number | null, ga: number | null): MatchResult | null {
  if (gf === null || ga === null) return null;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

export function adaptMatch(raw: unknown): LupiMatch {
  const rec = asRecord(raw);
  const gfRaw = rec.goals_for;
  const gaRaw = rec.goals_against;
  const played = gfRaw !== null && gfRaw !== undefined && gaRaw !== null && gaRaw !== undefined;
  const gf = played ? num(gfRaw) : null;
  const ga = played ? num(gaRaw) : null;
  return {
    id: num(rec.id),
    opp: str(rec.opponent ?? rec.opp) || "Rival",
    date: str(rec.date),
    home: rec.is_home !== false,
    gf,
    ga,
    result: matchResult(gf, ga),
    played,
    comp: str(rec.competition) || undefined,
  };
}

export function adaptMatches(matches: unknown): LupiMatch[] {
  if (!Array.isArray(matches)) return [];
  return matches.map(adaptMatch);
}
