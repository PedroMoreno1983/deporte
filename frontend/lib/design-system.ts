// ============================================================
// DEPORTE FC — Design System tokens (single source of truth)
// Aligned with `Deporte FC Design System/colors_and_type.css`
// Dark cyber/HUD aesthetic — neon green + sky blue accents
// ============================================================

export const STATUS_CONFIG: Record<string, { label: string; color: string; twBg: string; twBorder: string; twText: string }> = {
  available:  { label: "Disponible",   color: "#00ff87", twBg: "bg-[rgba(0,255,135,0.10)]", twBorder: "border-[rgba(0,255,135,0.30)]", twText: "text-[#00ff87]" },
  injured:    { label: "Lesionado",    color: "#ff3b30", twBg: "bg-[rgba(255,59,48,0.10)]", twBorder: "border-[rgba(255,59,48,0.30)]", twText: "text-[#ff3b30]" },
  recovering: { label: "Recuperación", color: "#f97316", twBg: "bg-[rgba(249,115,22,0.10)]",twBorder: "border-[rgba(249,115,22,0.30)]",twText: "text-[#f97316]" },
  suspended:  { label: "Suspendido",   color: "#f59e0b", twBg: "bg-[rgba(245,158,11,0.10)]",twBorder: "border-[rgba(245,158,11,0.30)]",twText: "text-[#f59e0b]" },
  inactive:   { label: "Inactivo",     color: "#64748b", twBg: "bg-slate-500/10",            twBorder: "border-slate-500/20",            twText: "text-slate-400" },
};

export const RISK_CONFIG: Record<string, { label: string; color: string; twBg: string; twBorder: string; twText: string }> = {
  low:      { label: "Bajo",     color: "#00ff87", twBg: "bg-[rgba(0,255,135,0.10)]", twBorder: "border-[rgba(0,255,135,0.30)]", twText: "text-[#00ff87]" },
  medium:   { label: "Moderado", color: "#f59e0b", twBg: "bg-[rgba(245,158,11,0.10)]",twBorder: "border-[rgba(245,158,11,0.30)]",twText: "text-[#f59e0b]" },
  high:     { label: "Alto",     color: "#f97316", twBg: "bg-[rgba(249,115,22,0.10)]",twBorder: "border-[rgba(249,115,22,0.30)]",twText: "text-[#f97316]" },
  critical: { label: "Crítico",  color: "#ff3b30", twBg: "bg-[rgba(255,59,48,0.10)]", twBorder: "border-[rgba(255,59,48,0.30)]", twText: "text-[#ff3b30]" },
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

export const POSITION_CONFIG: Record<string, { label: string; short: string; color: string; twBg: string; twBorder: string; twText: string }> = {
  goalkeeper:     { label: "Portero",            short: "POR", color: "#f59e0b", twBg: "bg-[rgba(245,158,11,0.10)]", twBorder: "border-[rgba(245,158,11,0.30)]", twText: "text-[#f59e0b]" },
  center_back:    { label: "Defensa Central",    short: "CTC", color: "#0ea5e9", twBg: "bg-[rgba(14,165,233,0.10)]", twBorder: "border-[rgba(14,165,233,0.30)]", twText: "text-[#0ea5e9]" },
  left_back:      { label: "Lateral Izquierdo",  short: "LTI", color: "#0ea5e9", twBg: "bg-[rgba(14,165,233,0.10)]", twBorder: "border-[rgba(14,165,233,0.30)]", twText: "text-[#0ea5e9]" },
  right_back:     { label: "Lateral Derecho",    short: "LTD", color: "#0ea5e9", twBg: "bg-[rgba(14,165,233,0.10)]", twBorder: "border-[rgba(14,165,233,0.30)]", twText: "text-[#0ea5e9]" },
  defensive_mid:  { label: "Mediocampista Def.", short: "MCD", color: "#00ff87", twBg: "bg-[rgba(0,255,135,0.10)]",  twBorder: "border-[rgba(0,255,135,0.30)]",  twText: "text-[#00ff87]" },
  central_mid:    { label: "Mediocampista",      short: "MC",  color: "#00ff87", twBg: "bg-[rgba(0,255,135,0.10)]",  twBorder: "border-[rgba(0,255,135,0.30)]",  twText: "text-[#00ff87]" },
  attacking_mid:  { label: "Mediocampista Of.",  short: "MCO", color: "#00ff87", twBg: "bg-[rgba(0,255,135,0.10)]",  twBorder: "border-[rgba(0,255,135,0.30)]",  twText: "text-[#00ff87]" },
  left_wing:      { label: "Extremo Izquierdo",  short: "EI",  color: "#ff3b30", twBg: "bg-[rgba(255,59,48,0.10)]",  twBorder: "border-[rgba(255,59,48,0.30)]",  twText: "text-[#ff3b30]" },
  right_wing:     { label: "Extremo Derecho",    short: "ED",  color: "#ff3b30", twBg: "bg-[rgba(255,59,48,0.10)]",  twBorder: "border-[rgba(255,59,48,0.30)]",  twText: "text-[#ff3b30]" },
  center_forward: { label: "Delantero",          short: "DEL", color: "#ff3b30", twBg: "bg-[rgba(255,59,48,0.10)]",  twBorder: "border-[rgba(255,59,48,0.30)]",  twText: "text-[#ff3b30]" },
};

export const POSITION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(POSITION_CONFIG).map(([k, v]) => [k, v.label])
);

export const ROLE_CONFIG: Record<string, { label: string; color: string; twBg: string; twBorder: string; twText: string }> = {
  admin:         { label: "Administrador", color: "#a855f7", twBg: "bg-[rgba(168,85,247,0.10)]", twBorder: "border-[rgba(168,85,247,0.30)]", twText: "text-[#a855f7]" },
  coach:         { label: "Entrenador",    color: "#00ff87", twBg: "bg-[rgba(0,255,135,0.10)]",  twBorder: "border-[rgba(0,255,135,0.30)]",  twText: "text-[#00ff87]" },
  kinesiologist: { label: "Kinesiólogo",   color: "#0ea5e9", twBg: "bg-[rgba(14,165,233,0.10)]", twBorder: "border-[rgba(14,165,233,0.30)]", twText: "text-[#0ea5e9]" },
  analyst:       { label: "Analista",      color: "#f59e0b", twBg: "bg-[rgba(245,158,11,0.10)]", twBorder: "border-[rgba(245,158,11,0.30)]", twText: "text-[#f59e0b]" },
};

export const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  grade_1: { label: "Grado I — Leve",       color: "#00ff87" },
  grade_2: { label: "Grado II — Moderado",  color: "#f59e0b" },
  grade_3: { label: "Grado III — Severo",   color: "#f97316" },
  grade_4: { label: "Grado IV — Quirúrgico",color: "#ff3b30" },
};

// ── Helpers ─────────────────────────────────────────────────

export function getStatusConfig(status?: string | null) {
  return STATUS_CONFIG[status ?? ""] ?? STATUS_CONFIG.inactive;
}

export function getRiskConfig(level?: string | null) {
  return RISK_CONFIG[level ?? ""] ?? RISK_CONFIG.low;
}

export function getPositionConfig(position?: string | null) {
  return POSITION_CONFIG[position ?? ""] ?? {
    label: "—", short: "—", color: "#64748b",
    twBg: "bg-slate-500/10", twBorder: "border-slate-500/20", twText: "text-slate-400",
  };
}

export function getRoleConfig(role?: string | null) {
  return ROLE_CONFIG[role ?? ""] ?? {
    label: "—", color: "#64748b",
    twBg: "bg-slate-500/10", twBorder: "border-slate-500/20", twText: "text-slate-400",
  };
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
