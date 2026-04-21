// ── Design system color tokens ──────────────────────────────────────────────

export const POSITION_GROUPS: Record<string, "gk" | "def" | "mid" | "atk"> = {
  goalkeeper:    "gk",
  center_back:   "def",
  left_back:     "def",
  right_back:    "def",
  defensive_mid: "mid",
  central_mid:   "mid",
  attacking_mid: "mid",
  left_wing:     "atk",
  right_wing:    "atk",
  center_forward:"atk",
};

export const POSITION_COLORS: Record<"gk" | "def" | "mid" | "atk", string> = {
  gk:  "#f59e0b",
  def: "#0ea5e9",
  mid: "#00ff87",
  atk: "#ff3b30",
};

export const POSITION_LABELS: Record<string, string> = {
  goalkeeper:    "Portero",
  center_back:   "Def. Central",
  left_back:     "Lat. Izq.",
  right_back:    "Lat. Der.",
  defensive_mid: "MC Def.",
  central_mid:   "MC",
  attacking_mid: "MC Of.",
  left_wing:     "Ext. Izq.",
  right_wing:    "Ext. Der.",
  center_forward:"Delantero",
};

export const POSITION_BADGE_LABELS: Record<"gk" | "def" | "mid" | "atk", string> = {
  gk:  "POR",
  def: "DEF",
  mid: "MED",
  atk: "DEL",
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available:  { label: "● Disponible",  color: "#00ff87", bg: "rgba(0,255,135,0.12)",   border: "rgba(0,255,135,0.30)"   },
  injured:    { label: "● Lesionado",   color: "#ff3b30", bg: "rgba(255,59,48,0.12)",   border: "rgba(255,59,48,0.30)"   },
  recovering: { label: "● Recuperando", color: "#f97316", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.30)"  },
  suspended:  { label: "● Suspendido",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.30)"  },
  inactive:   { label: "● Inactivo",    color: "#64748b", bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.25)" },
};

export const RISK_COLORS: Record<string, string> = {
  low:      "#00ff87",
  medium:   "#f59e0b",
  high:     "#f97316",
  critical: "#ff3b30",
};

export const RISK_LABELS: Record<string, string> = {
  low:      "Bajo",
  medium:   "Moderado",
  high:     "Alto",
  critical: "Crítico",
};

export const SEVERITY_COLORS: Record<string, string> = {
  grade_1: "#00ff87",
  grade_2: "#f59e0b",
  grade_3: "#f97316",
  grade_4: "#ff3b30",
};

export const SEVERITY_LABELS: Record<string, string> = {
  grade_1: "Grado I — Leve",
  grade_2: "Grado II — Moderado",
  grade_3: "Grado III — Severo",
  grade_4: "Grado IV — Quirúrgico",
};

export const ROLE_LABELS: Record<string, string> = {
  admin:         "Administrador",
  coach:         "Entrenador",
  kinesiologist: "Kinesiólogo",
  analyst:       "Analista",
};

export const ROLE_COLORS: Record<string, string> = {
  admin:         "#a855f7",
  coach:         "#00ff87",
  kinesiologist: "#0ea5e9",
  analyst:       "#f59e0b",
};
