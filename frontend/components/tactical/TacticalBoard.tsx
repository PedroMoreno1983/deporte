"use client";

import { useRef, useState, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw, Pencil, MousePointer, Trash2, ChevronDown, Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PosType = "GK" | "DEF" | "MID" | "FWD";

interface Player {
  id: string;
  num: string;
  abbr: string;
  type: PosType;
  x: number; // 0–100 % of pitch width
  y: number; // 0–100 % of pitch height
}

interface DrawPath {
  id: string;
  color: string;
  points: [number, number][]; // [x%, y%]
}

// ─── Formations ───────────────────────────────────────────────────────────────
const FORMATIONS: Record<string, { label: string; players: Player[] }> = {
  "4-4-2": {
    label: "4-4-2",
    players: [
      { id: "gk",  num: "1",  abbr: "GK",  type: "GK",  x: 50, y: 87 },
      { id: "rb",  num: "2",  abbr: "RD",  type: "DEF", x: 82, y: 68 },
      { id: "rcb", num: "5",  abbr: "CAD", type: "DEF", x: 63, y: 68 },
      { id: "lcb", num: "4",  abbr: "CAI", type: "DEF", x: 37, y: 68 },
      { id: "lb",  num: "3",  abbr: "LI",  type: "DEF", x: 18, y: 68 },
      { id: "rm",  num: "7",  abbr: "MD",  type: "MID", x: 82, y: 45 },
      { id: "rcm", num: "8",  abbr: "MC",  type: "MID", x: 62, y: 45 },
      { id: "lcm", num: "6",  abbr: "MC",  type: "MID", x: 38, y: 45 },
      { id: "lm",  num: "11", abbr: "MI",  type: "MID", x: 18, y: 45 },
      { id: "rs",  num: "9",  abbr: "DC",  type: "FWD", x: 62, y: 19 },
      { id: "ls",  num: "10", abbr: "DC",  type: "FWD", x: 38, y: 19 },
    ],
  },
  "4-3-3": {
    label: "4-3-3",
    players: [
      { id: "gk",  num: "1",  abbr: "GK",  type: "GK",  x: 50, y: 87 },
      { id: "rb",  num: "2",  abbr: "RD",  type: "DEF", x: 82, y: 68 },
      { id: "rcb", num: "5",  abbr: "CAD", type: "DEF", x: 63, y: 68 },
      { id: "lcb", num: "4",  abbr: "CAI", type: "DEF", x: 37, y: 68 },
      { id: "lb",  num: "3",  abbr: "LI",  type: "DEF", x: 18, y: 68 },
      { id: "cm1", num: "8",  abbr: "MC",  type: "MID", x: 27, y: 45 },
      { id: "cm2", num: "6",  abbr: "MCO", type: "MID", x: 50, y: 47 },
      { id: "cm3", num: "10", abbr: "MC",  type: "MID", x: 73, y: 45 },
      { id: "rw",  num: "7",  abbr: "ED",  type: "FWD", x: 78, y: 19 },
      { id: "cf",  num: "9",  abbr: "DC",  type: "FWD", x: 50, y: 15 },
      { id: "lw",  num: "11", abbr: "EI",  type: "FWD", x: 22, y: 19 },
    ],
  },
  "3-5-2": {
    label: "3-5-2",
    players: [
      { id: "gk",  num: "1",  abbr: "GK",  type: "GK",  x: 50, y: 87 },
      { id: "rcb", num: "4",  abbr: "CAD", type: "DEF", x: 70, y: 70 },
      { id: "cb",  num: "5",  abbr: "CA",  type: "DEF", x: 50, y: 72 },
      { id: "lcb", num: "3",  abbr: "CAI", type: "DEF", x: 30, y: 70 },
      { id: "rwb", num: "2",  abbr: "CAD", type: "MID", x: 88, y: 47 },
      { id: "rm",  num: "8",  abbr: "MC",  type: "MID", x: 68, y: 45 },
      { id: "cm",  num: "6",  abbr: "MCD", type: "MID", x: 50, y: 47 },
      { id: "lm",  num: "10", abbr: "MC",  type: "MID", x: 32, y: 45 },
      { id: "lwb", num: "11", abbr: "CAI", type: "MID", x: 12, y: 47 },
      { id: "rs",  num: "9",  abbr: "DC",  type: "FWD", x: 62, y: 19 },
      { id: "ls",  num: "7",  abbr: "DC",  type: "FWD", x: 38, y: 19 },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1",
    players: [
      { id: "gk",  num: "1",  abbr: "GK",  type: "GK",  x: 50, y: 87 },
      { id: "rb",  num: "2",  abbr: "RD",  type: "DEF", x: 82, y: 70 },
      { id: "rcb", num: "5",  abbr: "CAD", type: "DEF", x: 63, y: 70 },
      { id: "lcb", num: "4",  abbr: "CAI", type: "DEF", x: 37, y: 70 },
      { id: "lb",  num: "3",  abbr: "LI",  type: "DEF", x: 18, y: 70 },
      { id: "dm1", num: "6",  abbr: "MCD", type: "MID", x: 38, y: 54 },
      { id: "dm2", num: "8",  abbr: "MCD", type: "MID", x: 62, y: 54 },
      { id: "ram", num: "7",  abbr: "MAD", type: "MID", x: 76, y: 33 },
      { id: "cam", num: "10", abbr: "MCO", type: "MID", x: 50, y: 31 },
      { id: "lam", num: "11", abbr: "MAI", type: "MID", x: 24, y: 33 },
      { id: "st",  num: "9",  abbr: "DC",  type: "FWD", x: 50, y: 15 },
    ],
  },
  "5-3-2": {
    label: "5-3-2",
    players: [
      { id: "gk",  num: "1",  abbr: "GK",  type: "GK",  x: 50, y: 87 },
      { id: "rwb", num: "2",  abbr: "CAD", type: "DEF", x: 88, y: 68 },
      { id: "rcd", num: "5",  abbr: "CAD", type: "DEF", x: 68, y: 66 },
      { id: "cb",  num: "4",  abbr: "CA",  type: "DEF", x: 50, y: 68 },
      { id: "lcd", num: "3",  abbr: "CAI", type: "DEF", x: 32, y: 66 },
      { id: "lwb", num: "6",  abbr: "CAI", type: "DEF", x: 12, y: 68 },
      { id: "rm",  num: "8",  abbr: "MD",  type: "MID", x: 73, y: 45 },
      { id: "cm",  num: "7",  abbr: "MC",  type: "MID", x: 50, y: 47 },
      { id: "lm",  num: "10", abbr: "MI",  type: "MID", x: 27, y: 45 },
      { id: "rs",  num: "9",  abbr: "DC",  type: "FWD", x: 62, y: 19 },
      { id: "ls",  num: "11", abbr: "DC",  type: "FWD", x: 38, y: 19 },
    ],
  },
};

// ─── Colors per position ──────────────────────────────────────────────────────
const TYPE_COLORS: Record<PosType, { bg: string; border: string; text: string; glow: string; label: string }> = {
  GK:  { bg: "rgba(251,191,36,0.18)",  border: "rgba(251,191,36,0.85)", text: "#fbbf24", glow: "rgba(251,191,36,0.5)",  label: "Portero" },
  DEF: { bg: "rgba(59,130,246,0.18)",  border: "rgba(59,130,246,0.85)", text: "#60a5fa", glow: "rgba(59,130,246,0.5)",  label: "Defensa" },
  MID: { bg: "rgba(0,255,135,0.15)",   border: "rgba(0,255,135,0.85)",  text: "#00ff87", glow: "rgba(0,255,135,0.5)",   label: "Mediocampo" },
  FWD: { bg: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.85)",  text: "#f87171", glow: "rgba(239,68,68,0.5)",   label: "Delantero" },
};

const DRAW_COLORS = ["#00ff87", "#ffffff", "#3b82f6", "#f59e0b", "#ef4444", "#a78bfa"];

// ─── SVG Pitch ────────────────────────────────────────────────────────────────
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg));
  const y2 = cy + r * Math.sin(rad(endDeg));
  const diff = ((endDeg - startDeg) + 360) % 360;
  const large = diff > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function PitchSVG() {
  const W = 700, H = 460;
  const lc = "rgba(255,255,255,0.48)";
  const lw = 1.5;
  const PAW = 270, PAH = 110;
  const GAW = 120, GAH = 37;
  const GW = 56;
  const CR = 60;
  const PS_TOP = 73;
  const PS_BOT = H - PS_TOP;
  const PA_X = (W - PAW) / 2;
  const GA_X = (W - GAW) / 2;
  const G_X  = (W - GW)  / 2;
  const CORNER_R = 8;

  // Penalty arc: distance from spot to PA bottom = (3 + PAH) - PS_TOP = 113 - 73 = 40
  // sin(θ) = 40/60 → θ ≈ 41.81°
  const ARC_ANGLE = 41.81;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", width: "100%", height: "100%", borderRadius: "8px" }}
    >
      <defs>
        <pattern id="tb-grass" x="0" y="0" width="50" height={H} patternUnits="userSpaceOnUse">
          <rect width="25" height={H} fill="#183d22" />
          <rect x="25" width="25" height={H} fill="#142f1b" />
        </pattern>
        <filter id="tb-glow-green">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Grass */}
      <rect width={W} height={H} fill="url(#tb-grass)" rx="7" />

      {/* Subtle vignette */}
      <rect width={W} height={H} fill="url(#tb-vignette)" rx="7" opacity="0.3" />

      {/* Outer border */}
      <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke={lc} strokeWidth={lw} rx="4" />

      {/* Center line */}
      <line x1="3" y1={H / 2} x2={W - 3} y2={H / 2} stroke={lc} strokeWidth={lw} />

      {/* Center circle + spot */}
      <circle cx={W / 2} cy={H / 2} r={CR} fill="none" stroke={lc} strokeWidth={lw} />
      <circle cx={W / 2} cy={H / 2} r="4" fill={lc} />

      {/* ── TOP HALF ─────────────────── */}
      {/* Penalty area */}
      <rect x={PA_X} y="3" width={PAW} height={PAH} fill="none" stroke={lc} strokeWidth={lw} />
      {/* Goal area */}
      <rect x={GA_X} y="3" width={GAW} height={GAH} fill="none" stroke={lc} strokeWidth={lw} />
      {/* Goal (net indicator) */}
      <rect
        x={G_X} y={3 - 14} width={GW} height={14}
        fill="rgba(255,255,255,0.05)" stroke={lc} strokeWidth={lw}
        strokeDasharray="3 2"
      />
      {/* Penalty spot */}
      <circle cx={W / 2} cy={PS_TOP} r="3.5" fill={lc} />
      {/* Penalty arc */}
      <path d={describeArc(W / 2, PS_TOP, CR, ARC_ANGLE, 180 - ARC_ANGLE)} fill="none" stroke={lc} strokeWidth={lw} />

      {/* ── BOTTOM HALF ──────────────── */}
      <rect x={PA_X} y={H - PAH - 3} width={PAW} height={PAH} fill="none" stroke={lc} strokeWidth={lw} />
      <rect x={GA_X} y={H - GAH - 3} width={GAW} height={GAH} fill="none" stroke={lc} strokeWidth={lw} />
      <rect
        x={G_X} y={H - 3} width={GW} height={14}
        fill="rgba(255,255,255,0.05)" stroke={lc} strokeWidth={lw}
        strokeDasharray="3 2"
      />
      <circle cx={W / 2} cy={PS_BOT} r="3.5" fill={lc} />
      <path d={describeArc(W / 2, PS_BOT, CR, 180 + ARC_ANGLE, 360 - ARC_ANGLE)} fill="none" stroke={lc} strokeWidth={lw} />

      {/* ── Corner arcs ──────────────── */}
      <path d={`M 3 ${3 + CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 1 ${3 + CORNER_R} 3`} fill="none" stroke={lc} strokeWidth={lw} />
      <path d={`M ${W - 3 - CORNER_R} 3 A ${CORNER_R} ${CORNER_R} 0 0 1 ${W - 3} ${3 + CORNER_R}`} fill="none" stroke={lc} strokeWidth={lw} />
      <path d={`M 3 ${H - 3 - CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 0 ${3 + CORNER_R} ${H - 3}`} fill="none" stroke={lc} strokeWidth={lw} />
      <path d={`M ${W - 3 - CORNER_R} ${H - 3} A ${CORNER_R} ${CORNER_R} 0 0 0 ${W - 3} ${H - 3 - CORNER_R}`} fill="none" stroke={lc} strokeWidth={lw} />

      {/* Attack direction label */}
      <text x={W / 2} y={H / 2 - CR - 8} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="9" fontWeight="700" letterSpacing="3" fontFamily="monospace">
        ATAQUE
      </text>
      <text x={W / 2} y={H / 2 + CR + 16} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="9" fontWeight="700" letterSpacing="3" fontFamily="monospace">
        DEFENSA
      </text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TacticalBoard() {
  const pitchRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const [formKey, setFormKey] = useState("4-3-3");
  const [players, setPlayers] = useState<Player[]>(() =>
    FORMATIONS["4-3-3"].players.map(p => ({ ...p }))
  );
  const [mode, setMode] = useState<"move" | "draw">("move");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [activePath, setActivePath] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [showFormMenu, setShowFormMenu] = useState(false);

  // Convert clientX/Y to pitch percentage
  const getPitchPct = useCallback((clientX: number, clientY: number) => {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  // Token drag start (captures pointer)
  const handleTokenPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (mode !== "move") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(id);
  }, [mode]);

  const handleTokenPointerMove = useCallback((e: React.PointerEvent) => {
    if (mode !== "move" || !draggingId) return;
    const pos = getPitchPct(e.clientX, e.clientY);
    if (!pos) return;
    setPlayers(prev =>
      prev.map(p =>
        p.id === draggingId
          ? { ...p, x: Math.max(2, Math.min(98, pos.x)), y: Math.max(2, Math.min(98, pos.y)) }
          : p
      )
    );
  }, [mode, draggingId, getPitchPct]);

  const handleTokenPointerUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  // Pitch pointer events (for drawing)
  const handlePitchPointerDown = useCallback((e: React.PointerEvent) => {
    if (mode !== "draw") return;
    const pos = getPitchPct(e.clientX, e.clientY);
    if (!pos) return;
    setIsDrawing(true);
    setActivePath([[pos.x, pos.y]]);
  }, [mode, getPitchPct]);

  const handlePitchPointerMove = useCallback((e: React.PointerEvent) => {
    if (mode !== "draw" || !isDrawing) return;
    const pos = getPitchPct(e.clientX, e.clientY);
    if (!pos) return;
    setActivePath(prev => [...prev, [pos.x, pos.y]]);
  }, [mode, isDrawing, getPitchPct]);

  const handlePitchPointerUp = useCallback(() => {
    if (mode !== "draw" || !isDrawing) return;
    if (activePath.length > 2) {
      setPaths(prev => [
        ...prev,
        { id: `${uid}-${Date.now()}`, color: drawColor, points: activePath },
      ]);
    }
    setActivePath([]);
    setIsDrawing(false);
  }, [mode, isDrawing, activePath, drawColor, uid]);

  // Formation change
  const changeFormation = (key: string) => {
    setFormKey(key);
    setPlayers(FORMATIONS[key].players.map(p => ({ ...p })));
    setPaths([]);
    setActivePath([]);
    setShowFormMenu(false);
  };

  const resetFormation = () => {
    setPlayers(FORMATIONS[formKey].players.map(p => ({ ...p })));
    setPaths([]);
    setActivePath([]);
  };

  // Convert percentage path to SVG path string (viewBox 0 0 700 460)
  const pctToSVGPath = (pts: [number, number][]) => {
    if (pts.length < 2) return "";
    const sx = 700 / 100, sy = 460 / 100;
    return (
      `M ${(pts[0][0] * sx).toFixed(1)} ${(pts[0][1] * sy).toFixed(1)} ` +
      pts.slice(1).map(([x, y]) => `L ${(x * sx).toFixed(1)} ${(y * sy).toFixed(1)}`).join(" ")
    );
  };

  return (
    <div
      className="flex flex-col h-full"
      onClick={() => setShowFormMenu(false)}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-5 py-3 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Formation picker */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowFormMenu(v => !v)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all"
            style={{
              background: "rgba(0,255,135,0.08)",
              border: "1px solid rgba(0,255,135,0.3)",
              color: "#00ff87",
            }}
          >
            {FORMATIONS[formKey].label}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <AnimatePresence>
            {showFormMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute top-full mt-1 left-0 z-50 rounded-xl overflow-hidden shadow-2xl"
                style={{
                  background: "rgba(8,14,20,0.98)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  minWidth: "140px",
                }}
              >
                {Object.entries(FORMATIONS).map(([key, f]) => (
                  <button
                    key={key}
                    onClick={() => changeFormation(key)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      color: key === formKey ? "#00ff87" : "rgba(255,255,255,0.65)",
                      background: key === formKey ? "rgba(0,255,135,0.08)" : "transparent",
                    }}
                    onMouseEnter={e => {
                      if (key !== formKey) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    }}
                    onMouseLeave={e => {
                      if (key !== formKey) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {f.label}
                    {key === formKey && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-5 shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Mode toggle */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {(["move", "draw"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: mode === m ? "rgba(0,255,135,0.12)" : "transparent",
                color: mode === m ? "#00ff87" : "rgba(255,255,255,0.4)",
                borderRight: m === "move" ? "1px solid rgba(255,255,255,0.1)" : undefined,
              }}
            >
              {m === "move"
                ? <MousePointer className="w-3.5 h-3.5" />
                : <Pencil className="w-3.5 h-3.5" />}
              {m === "move" ? "Mover" : "Dibujar"}
            </button>
          ))}
        </div>

        {/* Color picker — only in draw mode */}
        <AnimatePresence>
          {mode === "draw" && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              className="flex items-center gap-1.5"
            >
              {DRAW_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setDrawColor(c)}
                  style={{
                    width: 18, height: 18,
                    borderRadius: "50%",
                    background: c,
                    outline: drawColor === c ? `2px solid ${c}` : "2px solid transparent",
                    outlineOffset: "2px",
                    transform: drawColor === c ? "scale(1.25)" : "scale(1)",
                    transition: "transform 0.15s, outline 0.15s",
                    flexShrink: 0,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* Clear drawings */}
        <AnimatePresence>
          {paths.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => { setPaths([]); setActivePath([]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar
            </motion.button>
          )}
        </AnimatePresence>

        {/* Reset formation */}
        <button
          onClick={resetFormation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#00ff87")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Resetear
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 p-4 min-h-0">
        {/* Pitch area */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {/* Outer glow wrapper */}
          <div
            style={{
              position: "relative",
              width: "min(calc(100% - 8px), calc((100vh - 260px) * 700 / 460))",
              aspectRatio: "700 / 460",
              flexShrink: 0,
              borderRadius: "10px",
              boxShadow: `
                0 0 0 1px rgba(0,255,135,0.1),
                0 8px 48px rgba(0,0,0,0.7),
                0 0 80px rgba(0,100,40,0.15)
              `,
            }}
          >
            {/* Pitch SVG */}
            <div style={{ position: "absolute", inset: 0 }}>
              <PitchSVG />
            </div>

            {/* Interaction layer */}
            <div
              ref={pitchRef}
              style={{
                position: "absolute",
                inset: 0,
                cursor: mode === "draw" ? "crosshair" : "default",
                touchAction: "none",
                userSelect: "none",
              }}
              onPointerDown={handlePitchPointerDown}
              onPointerMove={handlePitchPointerMove}
              onPointerUp={handlePitchPointerUp}
              onPointerLeave={handlePitchPointerUp}
            >
              {/* Drawing paths overlay (SVG with 700×460 coord space) */}
              <svg
                viewBox="0 0 700 460"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  overflow: "visible",
                }}
              >
                {paths.map(path => (
                  <path
                    key={path.id}
                    d={pctToSVGPath(path.points)}
                    fill="none"
                    stroke={path.color}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                ))}
                {activePath.length > 1 && (
                  <path
                    d={pctToSVGPath(activePath)}
                    fill="none"
                    stroke={drawColor}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                )}
              </svg>

              {/* Player tokens */}
              {players.map(player => {
                const c = TYPE_COLORS[player.type];
                const isDragging = draggingId === player.id;
                return (
                  <div
                    key={player.id}
                    style={{
                      position: "absolute",
                      left: `${player.x}%`,
                      top: `${player.y}%`,
                      transform: "translate(-50%, -50%)",
                      pointerEvents: mode === "draw" ? "none" : "auto",
                      cursor: isDragging ? "grabbing" : "grab",
                      zIndex: isDragging ? 20 : 10,
                      touchAction: "none",
                    }}
                    onPointerDown={e => handleTokenPointerDown(e, player.id)}
                    onPointerMove={handleTokenPointerMove}
                    onPointerUp={handleTokenPointerUp}
                    onPointerCancel={handleTokenPointerUp}
                  >
                    <motion.div
                      animate={{
                        scale: isDragging ? 1.18 : 1,
                        filter: isDragging
                          ? `drop-shadow(0 0 12px ${c.glow})`
                          : `drop-shadow(0 0 6px ${c.glow}88)`,
                      }}
                      whileHover={mode === "move" ? { scale: 1.1 } : {}}
                      transition={{ duration: 0.1 }}
                      className="flex flex-col items-center"
                      style={{ gap: 2 }}
                    >
                      {/* Jersey circle */}
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: c.bg,
                          border: `2px solid ${c.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 900,
                          color: c.text,
                          backdropFilter: "blur(6px)",
                          WebkitBackdropFilter: "blur(6px)",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {player.num}
                      </div>
                      {/* Position tag */}
                      <div
                        style={{
                          fontSize: 8,
                          fontWeight: 800,
                          color: c.text,
                          letterSpacing: "0.06em",
                          textShadow: `0 0 6px ${c.glow}`,
                          lineHeight: 1,
                          background: "rgba(0,0,0,0.55)",
                          padding: "1px 3px",
                          borderRadius: 3,
                        }}
                      >
                        {player.abbr}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right legend ─────────────────────────────────────────────── */}
        <div className="w-40 shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Position legend */}
          <div>
            <p
              className="text-[9px] font-bold uppercase tracking-[0.18em] mb-3"
              style={{ color: "rgba(100,116,139,0.8)" }}
            >
              Posiciones
            </p>
            <div className="flex flex-col gap-2">
              {(["GK", "DEF", "MID", "FWD"] as PosType[]).map(type => {
                const c = TYPE_COLORS[type];
                const count = players.filter(p => p.type === type).length;
                return (
                  <div key={type} className="flex items-center gap-2.5">
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: c.bg,
                        border: `2px solid ${c.border}`,
                        flexShrink: 0,
                        boxShadow: `0 0 8px ${c.glow}44`,
                      }}
                    />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>
                        {c.label}
                      </p>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>
                        {count} jugador{count !== 1 ? "es" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

          {/* Instructions */}
          <div>
            <p
              className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2"
              style={{ color: "rgba(100,116,139,0.8)" }}
            >
              Cómo usar
            </p>
            <div className="flex flex-col gap-2.5">
              <div
                className="rounded-lg p-2.5"
                style={{ background: "rgba(0,255,135,0.05)", border: "1px solid rgba(0,255,135,0.12)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MousePointer className="w-3 h-3" style={{ color: "#00ff87" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#00ff87" }}>Mover</span>
                </div>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  Arrastra jugadores a cualquier posición en la cancha.
                </p>
              </div>
              <div
                className="rounded-lg p-2.5"
                style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Pencil className="w-3 h-3" style={{ color: "#60a5fa" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa" }}>Dibujar</span>
                </div>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  Traza movimientos y jugadas táticas en la cancha.
                </p>
              </div>
            </div>
          </div>

          {/* Drawing count badge */}
          <AnimatePresence>
            {paths.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-lg p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <p style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.7)" }}>
                  {paths.length}
                </p>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                  trazo{paths.length !== 1 ? "s" : ""} dibujado{paths.length !== 1 ? "s" : ""}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
