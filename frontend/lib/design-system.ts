// ── Single source of truth for design tokens ────────────────────────────────

export const STATUS_CONFIG: Record<string, { label: string; color: string; twBg: string; twBorder: string; twText: string }> = {
  available:  { label: "Disponible",  color: "#10b981", twBg: "bg-emerald-500/10",  twBorder: "border-emerald-500/20",  twText: "text-emerald-400" },
  injured:    { label: "Lesionado",   color: "#ef4444", twBg: "bg-red-500/10",      twBorder: "border-red-500/20",      twText: "text-red-400" },
  recovering: { label: "Recuperación",color: "#f97316", twBg: "bg-orange-500/10",   twBorder: "border-orange-500/20",   twText: "text-orange-400" },
  suspended:  { label: "Suspendido",  color: "#f59e0b", twBg: "bg-amber-500/10",    twBorder: "border-amber-500/20",    twText: "text-amber-400" },
  inactive:   { label: "Inactivo",    color: "#64748b", twBg: "bg-slate-500/10",    twBorder: "border-slate-500/20",    twText: "text-slate-400" },
};

export const RISK_CONFIG: Record<string, { label: string; color: string; twBg: string; twBorder: string; twText: string }> = {
  low:      { label: "Bajo",      color: "#10b981", twBg: "bg-emerald-500/10",  twBorder: "border-emerald-500/20",  twText: "text-emerald-400" },
  medium:   { label: "Moderado",  color: "#f59e0b", twBg: "bg-amber-500/10",    twBorder: "border-amber-500/20",    twText: "text-amber-400" },
  high:     { label: "Alto",      color: "#f97316", twBg: "bg-orange-500/10",   twBorder: "border-orange-500/20",   twText: "text-orange-400" },
  critical: { label: "Crítico",   color: "#ef4444", twBg: "bg-red-500/10",      twBorder: "border-red-500/20",      twText: "text-red-400" },
};

export const POSITION_GROUPS: Record<string, "gk" | "def" | "mid" | "atk"> = {
  goalkeeper:     "gk",
  center_back:    "def",
  left_back:      "def",
  right_back:     "def",
  defensive_mid:  "mid",
  central_mid:    "mid",
  attacking_mid:  "mid",
  left_wing:      "atk",
  right_wing:     "atk",
  center_forward: "atk",
};

export const POSITION_CONFIG: Record<string, { label: string; short: string; color: string; twBg: string; twText: string }> = {
  goalkeeper:     { label: "Portero",            short: "POR", color: "#f59e0b", twBg: "bg-amber-500/10", twText: "text-amber-400" },
  center_back:    { label: "Defensa Central",    short: "CTC", color: "#0ea5e9", twBg: "bg-sky-500/10",   twText: "text-sky-400" },
  left_back:      { label: "Lateral Izquierdo",  short: "LTI", color: "#0ea5e9", twBg: "bg-sky-500/10",   twText: "text-sky-400" },
  right_back:     { label: "Lateral Derecho",    short: "LTD", color: "#0ea5e9", twBg: "bg-sky-500/10",   twText: "text-sky-400" },
  defensive_mid:  { label: "Mediocampista Def.", short: "MCD", color: "#10b981", twBg: "bg-emerald-500/10", twText: "text-emerald-400" },
  central_mid:    { label: "Mediocampista",      short: "MC",  color: "#10b981", twBg: "bg-emerald-500/10", twText: "text-emerald-400" },
  attacking_mid:  { label: "Mediocampista Of.",  short: "MCO", color: "#10b981", twBg: "bg-emerald-500/10", twText: "text-emerald-400" },
  left_wing:      { label: "Extremo Izquierdo",  short: "EI",  color: "#ef4444", twBg: "bg-red-500/10",   twText: "text-red-400" },
  right_wing:     { label: "Extremo Derecho",    short: "ED",  color: "#ef4444", twBg: "bg-red-500/10",   twText: "text-red-400" },
  center_forward: { label: "Delantero",          short: "DEL", color: "#ef4444", twBg: "bg-red-500/10",   twText: "text-red-400" },
};

export const POSITION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(POSITION_CONFIG).map(([k, v]) => [k, v.label])
);

export const ROLE_CONFIG: Record<string, { label: string; color: string; twBg: string; twText: string }> = {
  admin:         { label: "Administrador", color: "#a855f7", twBg: "bg-purple-500/10", twText: "text-purple-400" },
  coach:         { label: "Entrenador",    color: "#10b981", twBg: "bg-emerald-500/10", twText: "text-emerald-400" },
  kinesiologist: { label: "Kinesiólogo",   color: "#0ea5e9", twBg: "bg-sky-500/10",   twText: "text-sky-400" },
  analyst:       { label: "Analista",      color: "#f59e0b", twBg: "bg-amber-500/10", twText: "text-amber-400" },
};

export const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  grade_1: { label: "Grado I — Leve",       color: "#10b981" },
  grade_2: { label: "Grado II — Moderado",  color: "#f59e0b" },
  grade_3: { label: "Grado III — Severo",   color: "#f97316" },
  grade_4: { label: "Grado IV — Quirúrgico",color: "#ef4444" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getStatusConfig(status?: string | null) {
  return STATUS_CONFIG[status ?? ""] ?? STATUS_CONFIG.inactive;
}

export function getRiskConfig(level?: string | null) {
  return RISK_CONFIG[level ?? ""] ?? RISK_CONFIG.low;
}

export function getPositionConfig(position?: string | null) {
  return POSITION_CONFIG[position ?? ""] ?? { label: "—", short: "—", color: "#64748b", twBg: "bg-slate-500/10", twText: "text-slate-400" };
}

export function getRoleConfig(role?: string | null) {
  return ROLE_CONFIG[role ?? ""] ?? { label: "—", color: "#64748b", twBg: "bg-slate-500/10", twText: "text-slate-400" };
}

export function formatAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function formatDistance(meters: number | null): string {
  if (!meters) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}
