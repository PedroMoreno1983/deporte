// lib/lupi-fallbacks.ts — representative sample data for the Lupi screens whose
// rich, hand-drawn datasets have no single backend endpoint yet (training load,
// month calendar, video clips, model factors, per-player wellness flowers).
// Screens consume the real API first and fall back to these so the visual
// language always renders. Clearly sample — swap for live endpoints when ready.
import type { LupiPlayer, LupiWellnessDay, LupiWellPlayer, MatchResult } from "@/lib/lupi";

// ── Training ──────────────────────────────────────────────────────────────────
export type TrainType = "fisico" | "tactico" | "tecnico" | "recuperacion";

export const TRAIN_TYPE: Record<TrainType, { label: string; color: string }> = {
  fisico: { label: "físico", color: "var(--slate)" },
  tactico: { label: "táctico", color: "var(--pine)" },
  tecnico: { label: "técnico", color: "var(--ochre)" },
  recuperacion: { label: "recuperación", color: "var(--plum)" },
};

export interface TrainingWeek { week: string; sessions: [TrainType, number][] }

export const TRAINING_WEEKS: TrainingWeek[] = [
  { week: "S1", sessions: [["fisico", 62], ["tactico", 40], ["tecnico", 35], ["recuperacion", 18], ["tactico", 48]] },
  { week: "S2", sessions: [["fisico", 70], ["tecnico", 38], ["tactico", 52], ["recuperacion", 20]] },
  { week: "S3", sessions: [["fisico", 55], ["tactico", 60], ["tecnico", 30], ["tactico", 44], ["recuperacion", 22]] },
  { week: "S4", sessions: [["fisico", 80], ["tactico", 50], ["tecnico", 42], ["recuperacion", 16]] },
  { week: "S5", sessions: [["fisico", 48], ["tactico", 58], ["tecnico", 36], ["tactico", 40], ["recuperacion", 24]] },
  { week: "S6", sessions: [["fisico", 66], ["tactico", 46], ["tecnico", 40], ["recuperacion", 20]] },
];

export interface PlanDay { day: string; type: TrainType; intensity: number; label: string; match?: boolean }

export const WEEK_PLAN: PlanDay[] = [
  { day: "Lun", type: "recuperacion", intensity: 2, label: "Regenerativo + movilidad" },
  { day: "Mar", type: "fisico", intensity: 4, label: "Fuerza + resistencia" },
  { day: "Mié", type: "tactico", intensity: 3, label: "Salida de balón" },
  { day: "Jue", type: "tecnico", intensity: 3, label: "Finalización" },
  { day: "Vie", type: "tactico", intensity: 2, label: "Balón parado + activación" },
  { day: "Sáb", type: "fisico", intensity: 5, label: "Partido", match: true },
  { day: "Dom", type: "recuperacion", intensity: 1, label: "Descanso" },
];

// ── Calendar ──────────────────────────────────────────────────────────────────
export type CalType = "match" | "training" | "medical" | "rest" | "travel";

export const CAL_TYPE: Record<CalType, { label: string; color: string }> = {
  match: { label: "partido", color: "var(--terracotta)" },
  training: { label: "entrenamiento", color: "var(--pine)" },
  medical: { label: "médico", color: "var(--ochre)" },
  rest: { label: "descanso", color: "var(--ink-faint)" },
  travel: { label: "viaje", color: "var(--slate)" },
};

export const CALENDAR: Record<number, CalType[]> = {
  1: ["rest"], 2: ["training"], 3: ["training", "medical"], 4: ["match"], 5: ["training"],
  6: ["training"], 7: ["rest"], 8: ["training", "medical"], 9: ["training"], 10: ["training"],
  11: ["training", "medical"], 12: ["training"], 13: ["travel"], 14: ["match"], 15: ["rest"],
  16: ["training"], 17: ["training", "medical"], 18: ["training"], 19: ["training"], 20: ["match"],
  21: ["rest"], 22: ["training"], 23: ["training"], 24: ["training", "medical"], 25: ["training"],
  26: ["travel"], 27: ["match"], 28: ["rest"], 29: ["training"], 30: ["training", "medical"],
};

/** Build current-month metadata (Monday-first grid). */
export function buildCalMeta() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  // JS getDay(): 0=Sun..6=Sat → convert to Mon=0..Sun=6
  const jsFirst = new Date(year, month, 1).getDay();
  const firstWeekday = (jsFirst + 6) % 7;
  const monthName = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(now);
  return {
    monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
    firstWeekday,
    days,
    today: now.getDate(),
  };
}

// ── Video clips ───────────────────────────────────────────────────────────────
export interface VideoClip {
  id: number; title: string; opp: string; date: string; dur: string; tags: string[]; events: number;
}

export const VIDEO_CLIPS: VideoClip[] = [
  { id: 1, title: "Gol en contraataque", opp: "rival reciente", date: "31 may", dur: "0:42", tags: ["gol", "transición"], events: 7 },
  { id: 2, title: "Presión alta tras pérdida", opp: "rival reciente", date: "18 may", dur: "1:18", tags: ["presión", "táctico"], events: 12 },
  { id: 3, title: "Balón parado — córner ofensivo", opp: "rival reciente", date: "04 may", dur: "0:55", tags: ["abp"], events: 5 },
  { id: 4, title: "Errores en salida — análisis", opp: "rival reciente", date: "11 may", dur: "2:04", tags: ["salida", "errores"], events: 9 },
  { id: 5, title: "Movimientos sin balón", opp: "rival reciente", date: "24 may", dur: "1:33", tags: ["individual"], events: 8 },
  { id: 6, title: "Línea defensiva — basculación", opp: "rival reciente", date: "31 may", dur: "1:47", tags: ["defensa", "táctico"], events: 11 },
];

// ── Prediction model factors ──────────────────────────────────────────────────
export interface PredFactor { label: string; weight: number; note: string }

export const PRED_FACTORS: PredFactor[] = [
  { label: "Minutos acumulados", weight: 0.34, note: "carga total de la temporada" },
  { label: "Lesiones previas", weight: 0.27, note: "historial en los últimos 12 meses" },
  { label: "Edad", weight: 0.19, note: "mayores de 30 con más exposición" },
  { label: "Carga semanal", weight: 0.13, note: "salto de carga vs. semana anterior" },
  { label: "Auto-reporte", weight: 0.07, note: "dolor y sueño declarados" },
];

// ── Wellness ──────────────────────────────────────────────────────────────────
export const SAMPLE_WELLNESS_WEEK: LupiWellnessDay[] = [
  { day: "L", sleep: 4, mood: 4, soreness: 2, load: 3 },
  { day: "M", sleep: 3, mood: 4, soreness: 3, load: 4 },
  { day: "X", sleep: 4, mood: 5, soreness: 2, load: 2 },
  { day: "J", sleep: 2, mood: 3, soreness: 4, load: 5 },
  { day: "V", sleep: 3, mood: 3, soreness: 4, load: 4 },
  { day: "S", sleep: 5, mood: 5, soreness: 1, load: 1 },
  { day: "D", sleep: 4, mood: 4, soreness: 2, load: 2 },
];

/** Derive a plausible per-player wellness flower from risk (until a wellness
 *  endpoint per player is wired). Higher risk → more soreness, less rest. */
export function deriveWellPlayers(roster: LupiPlayer[], limit = 12): LupiWellPlayer[] {
  return roster.slice(0, limit).map((p) => {
    const base = Math.max(1, 5 - Math.round(p.risk / 25));
    return {
      id: p.id,
      name: p.name,
      pos: p.pos,
      sleep: Math.min(5, base + (p.id % 2)),
      mood: Math.min(5, Math.max(1, base + (p.id % 3) - 1)),
      soreness: Math.min(5, Math.max(1, Math.round(p.risk / 22))),
      load: Math.min(5, Math.max(1, 3 + (p.id % 3) - 1)),
    };
  });
}

// ── Season form from matches (oldest → newest) ────────────────────────────────
export function seasonFormFromResults(results: MatchResult[]): MatchResult[] {
  return results.length ? results : ["L", "W", "W", "D", "W", "L", "D", "W", "W", "D", "W", "L"];
}
