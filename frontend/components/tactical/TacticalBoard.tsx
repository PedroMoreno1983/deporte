"use client";

import { useRef, useState, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { playersApi, tacticalApi, aiTacticalApi } from "@/lib/api";
import {
  RotateCcw, Pencil, MousePointer, Trash2, ChevronDown, Check,
  Search, X, UserCheck, Circle, Save, Download, BookOpen, Clock, Loader2,
  Bot, Zap, Timer, ChevronUp, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PosType = "GK" | "DEF" | "MID" | "FWD";

interface Player {
  id: string; num: string; abbr: string; type: PosType; x: number; y: number;
}
interface Assignment {
  playerId: number; name: string; fullName: string; num: string; status: string;
}
interface DrawPath {
  id: string; color: string; points: [number, number][];
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

const TYPE_COLORS: Record<PosType, { bg: string; border: string; text: string; glow: string; label: string }> = {
  GK:  { bg: "rgba(251,191,36,0.18)",  border: "rgba(251,191,36,0.85)", text: "#fbbf24", glow: "rgba(251,191,36,0.5)",  label: "Portero" },
  DEF: { bg: "rgba(59,130,246,0.18)",  border: "rgba(59,130,246,0.85)", text: "#60a5fa", glow: "rgba(59,130,246,0.5)",  label: "Defensa" },
  MID: { bg: "rgba(60,107,101,0.20)",  border: "rgba(109,179,164,0.85)", text: "#6db3a4", glow: "rgba(60,107,101,0.5)",  label: "Mediocampo" },
  FWD: { bg: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.85)",  text: "#f87171", glow: "rgba(239,68,68,0.5)",   label: "Delantero" },
};

const STATUS_DOT: Record<string, string> = {
  available:  "#6db3a4",
  injured:    "#ff3b30",
  recovering: "#f97316",
  suspended:  "#f59e0b",
  inactive:   "#475569",
};

const DRAW_COLORS = ["#c0432b", "#ffffff", "#3b82f6", "#f59e0b", "#ff3b30", "#a78bfa"];

// ─── SVG Pitch ────────────────────────────────────────────────────────────────
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg));
  const y2 = cy + r * Math.sin(rad(endDeg));
  const diff = ((endDeg - startDeg) + 360) % 360;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${diff > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function PitchSVG() {
  const W = 700, H = 460;
  const lc = "rgba(255,255,255,0.48)", lw = 1.5;
  const PAW = 270, PAH = 110, GAW = 120, GAH = 37, GW = 56, CR = 60;
  const PS_TOP = 73, PS_BOT = H - PS_TOP;
  const PA_X = (W - PAW) / 2, GA_X = (W - GAW) / 2, G_X = (W - GW) / 2;
  const CORNER_R = 8, ARC_ANGLE = 41.81;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "100%", borderRadius: "8px" }}>
      <defs>
        <pattern id="tb-grass" x="0" y="0" width="50" height={H} patternUnits="userSpaceOnUse">
          <rect width="25" height={H} fill="#183d22" />
          <rect x="25" width="25" height={H} fill="#142f1b" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#tb-grass)" rx="7" />
      <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke={lc} strokeWidth={lw} rx="4" />
      <line x1="3" y1={H / 2} x2={W - 3} y2={H / 2} stroke={lc} strokeWidth={lw} />
      <circle cx={W / 2} cy={H / 2} r={CR} fill="none" stroke={lc} strokeWidth={lw} />
      <circle cx={W / 2} cy={H / 2} r="4" fill={lc} />
      <rect x={PA_X} y="3" width={PAW} height={PAH} fill="none" stroke={lc} strokeWidth={lw} />
      <rect x={GA_X} y="3" width={GAW} height={GAH} fill="none" stroke={lc} strokeWidth={lw} />
      <rect x={G_X} y={3 - 14} width={GW} height={14} fill="rgba(255,255,255,0.05)" stroke={lc} strokeWidth={lw} strokeDasharray="3 2" />
      <circle cx={W / 2} cy={PS_TOP} r="3.5" fill={lc} />
      <path d={describeArc(W / 2, PS_TOP, CR, ARC_ANGLE, 180 - ARC_ANGLE)} fill="none" stroke={lc} strokeWidth={lw} />
      <rect x={PA_X} y={H - PAH - 3} width={PAW} height={PAH} fill="none" stroke={lc} strokeWidth={lw} />
      <rect x={GA_X} y={H - GAH - 3} width={GAW} height={GAH} fill="none" stroke={lc} strokeWidth={lw} />
      <rect x={G_X} y={H - 3} width={GW} height={14} fill="rgba(255,255,255,0.05)" stroke={lc} strokeWidth={lw} strokeDasharray="3 2" />
      <circle cx={W / 2} cy={PS_BOT} r="3.5" fill={lc} />
      <path d={describeArc(W / 2, PS_BOT, CR, 180 + ARC_ANGLE, 360 - ARC_ANGLE)} fill="none" stroke={lc} strokeWidth={lw} />
      <path d={`M 3 ${3 + CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 1 ${3 + CORNER_R} 3`} fill="none" stroke={lc} strokeWidth={lw} />
      <path d={`M ${W - 3 - CORNER_R} 3 A ${CORNER_R} ${CORNER_R} 0 0 1 ${W - 3} ${3 + CORNER_R}`} fill="none" stroke={lc} strokeWidth={lw} />
      <path d={`M 3 ${H - 3 - CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 0 ${3 + CORNER_R} ${H - 3}`} fill="none" stroke={lc} strokeWidth={lw} />
      <path d={`M ${W - 3 - CORNER_R} ${H - 3} A ${CORNER_R} ${CORNER_R} 0 0 0 ${W - 3} ${H - 3 - CORNER_R}`} fill="none" stroke={lc} strokeWidth={lw} />
      <text x={W / 2} y={H / 2 - CR - 8} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="9" fontWeight="700" letterSpacing="3" fontFamily="monospace">ATAQUE</text>
      <text x={W / 2} y={H / 2 + CR + 16} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="9" fontWeight="700" letterSpacing="3" fontFamily="monospace">DEFENSA</text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TacticalBoard() {
  const pitchRef          = useRef<HTMLDivElement>(null);
  const pitchContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef        = useRef<HTMLDivElement>(null);
  const uid               = useId();
  const dragStart         = useRef<{ x: number; y: number } | null>(null);
  const queryClient       = useQueryClient();

  const [formKey, setFormKey]           = useState("4-3-3");
  const [players, setPlayers]           = useState<Player[]>(() => FORMATIONS["4-3-3"].players.map(p => ({ ...p })));
  const [mode, setMode]                 = useState<"move" | "draw">("move");
  const [draggingId, setDraggingId]     = useState<string | null>(null);
  const [paths, setPaths]               = useState<DrawPath[]>([]);
  const [activePath, setActivePath]     = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing]       = useState(false);
  const [drawColor, setDrawColor]       = useState(DRAW_COLORS[0]);
  const [showFormMenu, setShowFormMenu] = useState(false);
  const [assignments, setAssignments]   = useState<Record<string, Assignment>>({});
  const [pickerFor, setPickerFor]       = useState<string | null>(null);
  const [pickerPos, setPickerPos]       = useState({ x: 0, y: 0 });
  const [pickerSearch, setPickerSearch] = useState("");

  // Save modal
  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName]   = useState("");

  // AI Assistant
  const [aiOpen, setAiOpen]               = useState(false);
  const [aiMinute, setAiMinute]           = useState(0);
  const [aiScoreHome, setAiScoreHome]     = useState(0);
  const [aiScoreAway, setAiScoreAway]     = useState(0);
  const [aiOpponent, setAiOpponent]       = useState("");
  const [aiIsHome, setAiIsHome]           = useState(true);
  const [aiRec, setAiRec]                 = useState<any>(null);
  const [aiAutoEnabled, setAiAutoEnabled] = useState(false);
  const [aiAutoMinutes, setAiAutoMinutes] = useState(15);
  const autoTimerRef                      = useRef<ReturnType<typeof setInterval> | null>(null);

  // Saved plays panel
  const [showPlays, setShowPlays] = useState(false);

  // ── Roster ────────────────────────────────────────────────────────────────
  const { data: roster = [] } = useQuery({
    queryKey: ["players", "tactical-roster"],
    queryFn:  () => playersApi.list({ status: "available" }),
  });

  // ── Saved plays ───────────────────────────────────────────────────────────
  const { data: savedPlays = [] } = useQuery<any[]>({
    queryKey: ["tactical-plays"],
    queryFn:  () => tacticalApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (name: string) =>
      tacticalApi.create({ name, formation: formKey, players_json: players, assignments_json: assignments, paths_json: paths }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tactical-plays"] });
      setSaveModal(false);
      setSaveName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tacticalApi.delete(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["tactical-plays"] }),
  });

  const aiMutation = useMutation({
    mutationFn: () => aiTacticalApi.recommend({
      formation: formKey,
      players_json: players,
      assignments_json: assignments,
      match_context: {
        minute: aiMinute,
        score_home: aiScoreHome,
        score_away: aiScoreAway,
        opponent: aiOpponent || "Rival",
        is_home: aiIsHome,
      },
    }),
    onSuccess: (data) => setAiRec(data),
  });

  // Auto-analysis timer
  const startAutoTimer = useCallback(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    autoTimerRef.current = setInterval(() => {
      aiMutation.mutate();
    }, aiAutoMinutes * 60 * 1000);
  }, [aiAutoMinutes]);

  const stopAutoTimer = useCallback(() => {
    if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
  }, []);

  // Accept AI recommendation → apply formation change if suggested
  const acceptRecommendation = useCallback(() => {
    if (!aiRec) return;
    if (aiRec.suggested_formation && aiRec.suggested_formation !== formKey && FORMATIONS[aiRec.suggested_formation]) {
      changeFormation(aiRec.suggested_formation);
    }
    setAiRec(null);
  }, [aiRec, formKey]);

  const loadPlay = (play: any) => {
    setFormKey(play.formation);
    setPlayers(play.players_json);
    setAssignments(play.assignments_json ?? {});
    setPaths(play.paths_json ?? []);
    setPickerFor(null);
    setShowPlays(false);
  };

  // ── Download as SVG ───────────────────────────────────────────────────────
  const downloadSVG = useCallback(() => {
    const svgEl = pitchContainerRef.current?.querySelector("svg");
    if (!svgEl) return;

    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const W = 700, H = 460;
    const ns = "http://www.w3.org/2000/svg";

    // Drawing paths
    const pathsGroup = document.createElementNS(ns, "g");
    paths.forEach(path => {
      if (path.points.length < 2) return;
      const el = document.createElementNS(ns, "path");
      const d = `M ${(path.points[0][0] / 100 * W).toFixed(1)} ${(path.points[0][1] / 100 * H).toFixed(1)} ` +
        path.points.slice(1).map(([x, y]) => `L ${(x / 100 * W).toFixed(1)} ${(y / 100 * H).toFixed(1)}`).join(" ");
      el.setAttribute("d", d);
      el.setAttribute("fill", "none");
      el.setAttribute("stroke", path.color);
      el.setAttribute("stroke-width", "5");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("opacity", "0.85");
      pathsGroup.appendChild(el);
    });
    clone.appendChild(pathsGroup);

    // Player tokens
    const tokensGroup = document.createElementNS(ns, "g");
    players.forEach(player => {
      const cx = (player.x / 100) * W;
      const cy = (player.y / 100) * H;
      const c  = TYPE_COLORS[player.type];
      const assigned     = assignments[player.id];
      const displayNum   = assigned?.num  || player.num;
      const displayLabel = assigned?.name || player.abbr;

      const g = document.createElementNS(ns, "g");
      g.setAttribute("transform", `translate(${cx.toFixed(1)},${cy.toFixed(1)})`);

      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("r", "18");
      circle.setAttribute("fill", assigned ? c.bg : "rgba(0,0,0,0.5)");
      circle.setAttribute("stroke", c.border);
      circle.setAttribute("stroke-width", "2.5");
      g.appendChild(circle);

      const numText = document.createElementNS(ns, "text");
      numText.setAttribute("y", "4");
      numText.setAttribute("text-anchor", "middle");
      numText.setAttribute("fill", c.text);
      numText.setAttribute("font-size", "12");
      numText.setAttribute("font-weight", "900");
      numText.setAttribute("font-family", "monospace,sans-serif");
      numText.textContent = displayNum;
      g.appendChild(numText);

      const labelBg = document.createElementNS(ns, "rect");
      labelBg.setAttribute("x", "-20"); labelBg.setAttribute("y", "20");
      labelBg.setAttribute("width", "40"); labelBg.setAttribute("height", "12");
      labelBg.setAttribute("fill", "rgba(0,0,0,0.7)"); labelBg.setAttribute("rx", "2");
      g.appendChild(labelBg);

      const labelText = document.createElementNS(ns, "text");
      labelText.setAttribute("y", "30");
      labelText.setAttribute("text-anchor", "middle");
      labelText.setAttribute("fill", c.text);
      labelText.setAttribute("font-size", "7.5");
      labelText.setAttribute("font-weight", "800");
      labelText.setAttribute("font-family", "monospace,sans-serif");
      labelText.textContent = displayLabel;
      g.appendChild(labelText);

      if (assigned) {
        const dot = document.createElementNS(ns, "circle");
        dot.setAttribute("cx", "13"); dot.setAttribute("cy", "-13"); dot.setAttribute("r", "4.5");
        dot.setAttribute("fill", STATUS_DOT[assigned.status] ?? "#475569");
        dot.setAttribute("stroke", "rgba(0,0,0,0.8)"); dot.setAttribute("stroke-width", "1.5");
        g.appendChild(dot);
      }
      tokensGroup.appendChild(g);
    });
    clone.appendChild(tokensGroup);

    // Watermark
    const wm = document.createElementNS(ns, "text");
    wm.setAttribute("x", "350"); wm.setAttribute("y", "452");
    wm.setAttribute("text-anchor", "middle");
    wm.setAttribute("fill", "rgba(255,255,255,0.2)");
    wm.setAttribute("font-size", "9"); wm.setAttribute("font-family", "sans-serif");
    wm.textContent = `DEPORTE FC · ${FORMATIONS[formKey].label}`;
    clone.appendChild(wm);

    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob   = new Blob([svgStr], { type: "image/svg+xml" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `pizarra_${FORMATIONS[formKey].label.replace(/-/g, "")}_${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [players, assignments, paths, formKey]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const assignedIds    = new Set(Object.values(assignments).map(a => a.playerId));
  const assignedCount  = Object.keys(assignments).length;
  const filteredRoster = (roster as any[]).filter(p => {
    const q = pickerSearch.toLowerCase();
    return !q || p.full_name?.toLowerCase().includes(q) || String(p.jersey_number ?? "").includes(q);
  });

  const getPitchPct = useCallback((clientX: number, clientY: number) => {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left)  / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top)   / rect.height) * 100)),
    };
  }, []);

  // ── Token drag ────────────────────────────────────────────────────────────
  const handleTokenPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (mode !== "move") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDraggingId(id);
    setPickerFor(null);
  }, [mode]);

  const handleTokenPointerMove = useCallback((e: React.PointerEvent) => {
    if (mode !== "move" || !draggingId) return;
    const pos = getPitchPct(e.clientX, e.clientY);
    if (!pos) return;
    setPlayers(prev => prev.map(p =>
      p.id === draggingId ? { ...p, x: Math.max(2, Math.min(98, pos.x)), y: Math.max(2, Math.min(98, pos.y)) } : p
    ));
  }, [mode, draggingId, getPitchPct]);

  const handleTokenPointerUp = useCallback((e: React.PointerEvent, tokenId: string) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.sqrt(dx * dx + dy * dy) < 6 && mode === "move") {
      const rect = wrapperRef.current?.getBoundingClientRect();
      setPickerPos({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
      setPickerFor(prev => prev === tokenId ? null : tokenId);
      setPickerSearch("");
    }
    setDraggingId(null);
    dragStart.current = null;
  }, [mode]);

  // ── Drawing ───────────────────────────────────────────────────────────────
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
    if (activePath.length > 2)
      setPaths(prev => [...prev, { id: `${uid}-${Date.now()}`, color: drawColor, points: activePath }]);
    setActivePath([]);
    setIsDrawing(false);
  }, [mode, isDrawing, activePath, drawColor, uid]);

  // ── Formation ─────────────────────────────────────────────────────────────
  const changeFormation = (key: string) => {
    setFormKey(key);
    setPlayers(FORMATIONS[key].players.map(p => ({ ...p })));
    setPaths([]); setActivePath([]); setAssignments({}); setPickerFor(null); setShowFormMenu(false);
  };
  const resetFormation = () => {
    setPlayers(FORMATIONS[formKey].players.map(p => ({ ...p })));
    setPaths([]); setActivePath([]); setAssignments({}); setPickerFor(null);
  };

  // ── Assign / unassign ─────────────────────────────────────────────────────
  const assignPlayer = (tokenId: string, p: any) => {
    const parts = (p.full_name as string).split(" ");
    const name  = parts[parts.length - 1].toUpperCase();
    setAssignments(prev => ({
      ...prev,
      [tokenId]: { playerId: p.id, name, fullName: p.full_name, num: String(p.jersey_number ?? ""), status: p.status ?? "available" },
    }));
    setPickerFor(null);
  };
  const unassign = (tokenId: string) => {
    setAssignments(prev => { const n = { ...prev }; delete n[tokenId]; return n; });
    setPickerFor(null);
  };

  const pctToSVGPath = (pts: [number, number][]) => {
    if (pts.length < 2) return "";
    return `M ${(pts[0][0] * 7).toFixed(1)} ${(pts[0][1] * 4.6).toFixed(1)} ` +
      pts.slice(1).map(([x, y]) => `L ${(x * 7).toFixed(1)} ${(y * 4.6).toFixed(1)}`).join(" ");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="flex flex-col h-full" style={{ position: "relative", background: "#211d18", borderRadius: 14 }}
      onClick={() => { setShowFormMenu(false); setPickerFor(null); setShowPlays(false); }}>

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 py-3 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Formation */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowFormMenu(v => !v)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold"
            style={{ background: "rgba(192,67,43,0.08)", border: "1px solid rgba(192,67,43,0.3)", color: "#c0432b" }}>
            {FORMATIONS[formKey].label} <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <AnimatePresence>
            {showFormMenu && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute top-full mt-1 left-0 z-50 rounded-xl overflow-hidden shadow-2xl"
                style={{ background: "rgba(8,14,20,0.98)", border: "1px solid rgba(255,255,255,0.12)", minWidth: 140 }}>
                {Object.entries(FORMATIONS).map(([key, f]) => (
                  <button key={key} onClick={() => changeFormation(key)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold"
                    style={{ color: key === formKey ? "#c0432b" : "rgba(255,255,255,0.65)", background: key === formKey ? "rgba(192,67,43,0.08)" : "transparent" }}
                    onMouseEnter={e => { if (key !== formKey) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { if (key !== formKey) e.currentTarget.style.background = "transparent"; }}>
                    {f.label} {key === formKey && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-5 shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Mode */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          {(["move", "draw"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
              style={{ background: mode === m ? "rgba(192,67,43,0.12)" : "transparent", color: mode === m ? "#c0432b" : "rgba(255,255,255,0.4)", borderRight: m === "move" ? "1px solid rgba(255,255,255,0.1)" : undefined }}>
              {m === "move" ? <MousePointer className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              {m === "move" ? "Mover" : "Dibujar"}
            </button>
          ))}
        </div>

        {/* Draw colors */}
        <AnimatePresence>
          {mode === "draw" && (
            <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} className="flex items-center gap-1.5">
              {DRAW_COLORS.map(c => (
                <button key={c} onClick={() => setDrawColor(c)}
                  style={{ width: 18, height: 18, borderRadius: "50%", background: c, outline: drawColor === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: 2, transform: drawColor === c ? "scale(1.25)" : "scale(1)", transition: "transform 0.15s", flexShrink: 0 }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Assigned badge */}
        <AnimatePresence>
          {assignedCount > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: "rgba(192,67,43,0.08)", border: "1px solid rgba(192,67,43,0.2)" }}>
              <UserCheck className="w-3.5 h-3.5" style={{ color: "#c0432b" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#c0432b" }}>{assignedCount}/11</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* Clear drawings */}
        <AnimatePresence>
          {paths.length > 0 && (
            <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => { setPaths([]); setActivePath([]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ff3b30")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
              <Trash2 className="w-3.5 h-3.5" /> Limpiar
            </motion.button>
          )}
        </AnimatePresence>

        {/* AI Assistant button */}
        <button onClick={e => { e.stopPropagation(); setAiOpen(v => !v); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ color: aiOpen ? "#a78bfa" : "rgba(255,255,255,0.5)", background: aiOpen ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${aiOpen ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`, transition: "all 0.15s" }}>
          <Bot className="w-3.5 h-3.5" /> IA
        </button>

        {/* Download */}
        <button onClick={downloadSVG}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#60a5fa"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
          <Download className="w-3.5 h-3.5" /> Descargar
        </button>

        {/* Save */}
        <button onClick={e => { e.stopPropagation(); setSaveModal(true); setSaveName(""); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ color: "#c0432b", background: "rgba(192,67,43,0.08)", border: "1px solid rgba(192,67,43,0.25)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(192,67,43,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(192,67,43,0.08)")}>
          <Save className="w-3.5 h-3.5" /> Guardar
        </button>

        {/* Reset */}
        <button onClick={resetFormation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#c0432b")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
          <RotateCcw className="w-3.5 h-3.5" /> Resetear
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 p-4 min-h-0">

        {/* Pitch */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div ref={pitchContainerRef}
            style={{ position: "relative", width: "min(calc(100% - 8px), calc((100vh - 260px) * 700 / 460))", aspectRatio: "700 / 460", flexShrink: 0, borderRadius: 10, boxShadow: "0 0 0 1px rgba(192,67,43,0.1), 0 8px 48px rgba(0,0,0,0.7), 0 0 80px rgba(0,100,40,0.15)" }}>
            <div style={{ position: "absolute", inset: 0 }}><PitchSVG /></div>

            {/* Interaction layer */}
            <div ref={pitchRef}
              style={{ position: "absolute", inset: 0, cursor: mode === "draw" ? "crosshair" : "default", touchAction: "none", userSelect: "none" }}
              onPointerDown={handlePitchPointerDown}
              onPointerMove={handlePitchPointerMove}
              onPointerUp={handlePitchPointerUp}
              onPointerLeave={handlePitchPointerUp}>

              {/* Drawing overlay */}
              <svg viewBox="0 0 700 460" preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
                {paths.map(path => (
                  <path key={path.id} d={pctToSVGPath(path.points)} fill="none" stroke={path.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
                ))}
                {activePath.length > 1 && (
                  <path d={pctToSVGPath(activePath)} fill="none" stroke={drawColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
                )}
              </svg>

              {/* Tokens */}
              {players.map(player => {
                const c            = TYPE_COLORS[player.type];
                const isDragging   = draggingId === player.id;
                const isOpen       = pickerFor === player.id;
                const assigned     = assignments[player.id];
                const displayNum   = assigned?.num   || player.num;
                const displayLabel = assigned?.name  || player.abbr;

                return (
                  <div key={player.id}
                    style={{ position: "absolute", left: `${player.x}%`, top: `${player.y}%`, transform: "translate(-50%, -50%)", pointerEvents: mode === "draw" ? "none" : "auto", cursor: isDragging ? "grabbing" : "grab", zIndex: isDragging || isOpen ? 20 : 10, touchAction: "none" }}
                    onPointerDown={e => handleTokenPointerDown(e, player.id)}
                    onPointerMove={handleTokenPointerMove}
                    onPointerUp={e => handleTokenPointerUp(e, player.id)}
                    onPointerCancel={e => handleTokenPointerUp(e, player.id)}
                    onClick={e => e.stopPropagation()}>
                    <motion.div
                      animate={{ scale: isDragging ? 1.18 : isOpen ? 1.12 : 1, filter: isDragging ? `drop-shadow(0 0 14px ${c.glow})` : isOpen ? `drop-shadow(0 0 10px ${c.glow})` : `drop-shadow(0 0 6px ${c.glow}88)` }}
                      whileHover={mode === "move" ? { scale: 1.1 } : {}}
                      transition={{ duration: 0.1 }}
                      className="flex flex-col items-center" style={{ gap: 2 }}>
                      {/* Circle */}
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: assigned ? c.bg : "rgba(0,0,0,0.4)", border: `2px solid ${isOpen ? c.text : c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: displayNum.length > 2 ? 9 : 12, fontWeight: 900, color: c.text, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", position: "relative" }}>
                        {displayNum}
                        {assigned && (
                          <div style={{ position: "absolute", bottom: -1, right: -1, width: 9, height: 9, borderRadius: "50%", background: STATUS_DOT[assigned.status] ?? "#475569", border: "1.5px solid rgba(0,0,0,0.8)" }} />
                        )}
                      </div>
                      {/* Label — name if assigned, abbr if not */}
                      <div style={{ fontSize: assigned ? 7.5 : 8, fontWeight: 800, color: c.text, letterSpacing: "0.04em", textShadow: `0 0 6px ${c.glow}`, lineHeight: 1, background: "rgba(0,0,0,0.65)", padding: "1px 4px", borderRadius: 3, maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {displayLabel}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────── */}
        <div className="w-44 shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Saved plays */}
          <div>
            <button
              onClick={e => { e.stopPropagation(); setShowPlays(v => !v); }}
              className="w-full flex items-center justify-between mb-2"
              style={{ color: "rgba(100,116,139,0.9)" }}>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" />
                <p className="text-[9px] font-bold uppercase tracking-[0.18em]">Jugadas guardadas</p>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#c0432b" }}>{(savedPlays as any[]).length}</span>
            </button>

            <AnimatePresence>
              {showPlays && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  {(savedPlays as any[]).length === 0 ? (
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "8px 0" }}>Sin jugadas guardadas</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {(savedPlays as any[]).map((play: any) => (
                        <div key={play.id}
                          className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <button onClick={e => { e.stopPropagation(); loadPlay(play); }}
                            className="flex-1 text-left min-w-0">
                            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{play.name}</p>
                            <p style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{play.formation}</p>
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(play.id); }}
                            style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, lineHeight: 0 }}
                            onMouseEnter={el => (el.currentTarget.style.color = "#ff3b30")}
                            onMouseLeave={el => (el.currentTarget.style.color = "rgba(255,255,255,0.2)")}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

          {/* Positions legend */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: "rgba(100,116,139,0.8)" }}>Posiciones</p>
            <div className="flex flex-col gap-2">
              {(["GK", "DEF", "MID", "FWD"] as PosType[]).map(type => {
                const c     = TYPE_COLORS[type];
                const count = players.filter(p => p.type === type).length;
                return (
                  <div key={type} className="flex items-center gap-2.5">
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: c.bg, border: `2px solid ${c.border}`, flexShrink: 0, boxShadow: `0 0 8px ${c.glow}44` }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{c.label}</p>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{count} jugador{count !== 1 ? "es" : ""}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

          {/* Instructions */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "rgba(100,116,139,0.8)" }}>Instrucciones</p>
            <div className="flex flex-col gap-2">
              <div className="rounded-lg p-2.5" style={{ background: "rgba(192,67,43,0.05)", border: "1px solid rgba(192,67,43,0.12)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <MousePointer className="w-3 h-3" style={{ color: "#c0432b" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#c0432b" }}>Mover</span>
                </div>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>Arrastra para reposicionar. Clic para asignar nombre real.</p>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Pencil className="w-3 h-3" style={{ color: "#60a5fa" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa" }}>Dibujar</span>
                </div>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>Traza movimientos tácticos sobre la cancha.</p>
              </div>
            </div>
          </div>

          {assignedCount > 0 && (
            <div className="rounded-lg p-2.5 text-center" style={{ background: "rgba(192,67,43,0.06)", border: "1px solid rgba(192,67,43,0.15)" }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#c0432b" }}>{assignedCount}<span style={{ fontSize: 12, color: "rgba(192,67,43,0.5)" }}>/11</span></p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>jugadores asignados</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Player Picker Popover ─────────────────────────── */}
      <AnimatePresence>
        {pickerFor && (
          <>
            <div style={{ position: "absolute", inset: 0, zIndex: 30 }} onClick={() => setPickerFor(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: -8 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{   opacity: 0, scale: 0.93, y: -8  }}
              transition={{ duration: 0.14 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: "absolute",
                left: Math.min(pickerPos.x, (wrapperRef.current?.offsetWidth ?? 700) - 238),
                top:  Math.min(pickerPos.y + 14, (wrapperRef.current?.offsetHeight ?? 600) - 320),
                zIndex: 40, width: 228, borderRadius: 14,
                background: "rgba(6,12,18,0.97)",
                border: "1px solid rgba(192,67,43,0.2)",
                boxShadow: "0 20px 56px rgba(0,0,0,0.85), 0 0 0 1px rgba(192,67,43,0.06)",
                overflow: "hidden",
              }}>
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>Asignar jugador</p>
                  <p style={{ fontSize: 9, color: "rgba(192,67,43,0.6)", marginTop: 1 }}>
                    {players.find(p => p.id === pickerFor)?.abbr} · {FORMATIONS[formKey].label}
                  </p>
                </div>
                <button onClick={() => setPickerFor(null)} style={{ color: "rgba(255,255,255,0.3)", lineHeight: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "white")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-3 pb-2">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <input autoFocus value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Buscar por nombre o número..."
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 11, color: "rgba(255,255,255,0.85)", caretColor: "#c0432b" }} />
                </div>
              </div>

              <div style={{ maxHeight: 230, overflowY: "auto", paddingBottom: 8 }}>
                {assignments[pickerFor!] && (
                  <button onClick={() => unassign(pickerFor!)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
                    style={{ color: "rgba(239,68,68,0.8)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <X className="w-3 h-3" />
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700 }}>Sin asignar</p>
                      <p style={{ fontSize: 9, color: "rgba(239,68,68,0.5)" }}>Quitar jugador de esta posición</p>
                    </div>
                  </button>
                )}
                {filteredRoster.length === 0
                  ? <p className="text-center py-5" style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Sin resultados</p>
                  : filteredRoster.map((p: any) => {
                    const isMine        = assignments[pickerFor!]?.playerId === p.id;
                    const usedElsewhere = assignedIds.has(p.id) && !isMine;
                    return (
                      <button key={p.id}
                        onClick={() => !usedElsewhere && assignPlayer(pickerFor!, p)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
                        style={{ opacity: usedElsewhere ? 0.35 : 1, cursor: usedElsewhere ? "not-allowed" : "pointer" }}
                        onMouseEnter={e => { if (!usedElsewhere) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: isMine ? "rgba(192,67,43,0.15)" : "rgba(255,255,255,0.07)", border: `1.5px solid ${isMine ? "rgba(192,67,43,0.6)" : "rgba(255,255,255,0.12)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: isMine ? "#c0432b" : "rgba(255,255,255,0.7)", flexShrink: 0 }}>
                          {p.jersey_number ?? "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: isMine ? "#c0432b" : "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.full_name}</p>
                          <div className="flex items-center gap-1">
                            <Circle style={{ width: 6, height: 6, fill: STATUS_DOT[p.status] ?? "#475569", color: "transparent", flexShrink: 0 }} />
                            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{p.position ?? "—"}</p>
                          </div>
                        </div>
                        {isMine && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#c0432b" }} />}
                      </button>
                    );
                  })
                }
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── AI Assistant Panel ───────────────────────────── */}
      <AnimatePresence>
        {aiOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 56, right: 0, bottom: 0,
              width: 300, zIndex: 35, display: "flex", flexDirection: "column",
              background: "rgba(6,10,20,0.97)", borderLeft: "1px solid rgba(167,139,250,0.2)",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.6)",
            }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(167,139,250,0.15)" }}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)" }}>
                  <Bot className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>Asistente Táctico IA</p>
                  <p style={{ fontSize: 9, color: "rgba(167,139,250,0.6)" }}>Powered by Llama 3.3 · Groq</p>
                </div>
              </div>
              <button onClick={() => setAiOpen(false)} style={{ color: "rgba(255,255,255,0.3)", lineHeight: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

              {/* Match context */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2.5" style={{ color: "rgba(167,139,250,0.7)" }}>Contexto del Partido</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Minuto</label>
                    <input type="number" min={0} max={120} value={aiMinute}
                      onChange={e => setAiMinute(Number(e.target.value))}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "white", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Rival</label>
                    <input type="text" value={aiOpponent} onChange={e => setAiOpponent(e.target.value)}
                      placeholder="Nombre..."
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "white", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                {/* Score */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <label style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>{aiIsHome ? "Nosotros" : aiOpponent || "Rival"}</label>
                    <input type="number" min={0} max={20} value={aiScoreHome}
                      onChange={e => setAiScoreHome(Number(e.target.value))}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", fontSize: 16, fontWeight: 900, color: "white", textAlign: "center", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "rgba(255,255,255,0.4)", marginTop: 16 }}>-</span>
                  <div className="flex-1">
                    <label style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>{!aiIsHome ? "Nosotros" : aiOpponent || "Rival"}</label>
                    <input type="number" min={0} max={20} value={aiScoreAway}
                      onChange={e => setAiScoreAway(Number(e.target.value))}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", fontSize: 16, fontWeight: 900, color: "white", textAlign: "center", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                {/* Home/Away toggle */}
                <button onClick={() => setAiIsHome(v => !v)}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  Jugamos como: <span style={{ color: "#a78bfa", fontWeight: 700 }}>{aiIsHome ? "Local" : "Visitante"}</span> (clic para cambiar)
                </button>
              </div>

              {/* Auto-analysis */}
              <div className="rounded-xl p-3" style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.12)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-3 h-3" style={{ color: "#a78bfa" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa" }}>Auto-análisis</span>
                  </div>
                  <button
                    onClick={() => {
                      if (aiAutoEnabled) { stopAutoTimer(); setAiAutoEnabled(false); }
                      else { startAutoTimer(); setAiAutoEnabled(true); }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold"
                    style={{ background: aiAutoEnabled ? "rgba(192,67,43,0.12)" : "rgba(255,255,255,0.06)", color: aiAutoEnabled ? "#c0432b" : "rgba(255,255,255,0.5)", border: `1px solid ${aiAutoEnabled ? "rgba(192,67,43,0.3)" : "rgba(255,255,255,0.1)"}` }}>
                    {aiAutoEnabled ? "Activo" : "Inactivo"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Cada</span>
                  {[5, 10, 15, 20].map(min => (
                    <button key={min} onClick={() => { setAiAutoMinutes(min); if (aiAutoEnabled) startAutoTimer(); }}
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ background: aiAutoMinutes === min ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)", color: aiAutoMinutes === min ? "#a78bfa" : "rgba(255,255,255,0.4)", border: `1px solid ${aiAutoMinutes === min ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                      {min}'
                    </button>
                  ))}
                </div>
              </div>

              {/* Analyze button */}
              <button
                onClick={() => aiMutation.mutate()}
                disabled={aiMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)", cursor: aiMutation.isPending ? "not-allowed" : "pointer" }}>
                {aiMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
                  : <><Zap className="w-4 h-4" /> Analizar ahora</>}
              </button>

              {/* Error */}
              {aiMutation.isError && (
                <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <p style={{ fontSize: 11, color: "#f87171" }}>Error al conectar con el asistente. Verifica la API key de Groq en el servidor.</p>
                </div>
              )}

              {/* Recommendation */}
              {aiRec && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(167,139,250,0.25)", background: "rgba(167,139,250,0.06)" }}>

                  {/* Urgency header */}
                  <div className="px-3 py-2 flex items-center justify-between"
                    style={{ background: ({ baja: "rgba(192,67,43,0.08)", media: "rgba(245,158,11,0.08)", alta: "rgba(249,115,22,0.08)", critica: "rgba(239,68,68,0.10)" } as any)[aiRec.urgency] ?? "rgba(167,139,250,0.08)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" style={{ color: ({ baja: "#c0432b", media: "#f59e0b", alta: "#f97316", critica: "#ff3b30" } as any)[aiRec.urgency] }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: ({ baja: "#c0432b", media: "#f59e0b", alta: "#f97316", critica: "#ff3b30" } as any)[aiRec.urgency], textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        Urgencia {aiRec.urgency}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Min. {aiMinute}</span>
                  </div>

                  <div className="p-3 flex flex-col gap-3">
                    {/* Analysis */}
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{aiRec.analysis}</p>

                    {/* Suggested formation */}
                    {aiRec.suggested_formation && aiRec.suggested_formation !== formKey && (
                      <div className="rounded-lg px-3 py-2" style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa" }}>
                          Cambiar a <span style={{ fontSize: 13 }}>{aiRec.suggested_formation}</span>
                        </p>
                        {aiRec.formation_reason && <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{aiRec.formation_reason}</p>}
                      </div>
                    )}

                    {/* Player changes */}
                    {aiRec.player_changes?.length > 0 && (
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Movimientos sugeridos</p>
                        <div className="flex flex-col gap-1.5">
                          {aiRec.player_changes.map((ch: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa" }}>{ch.current_abbr}</span>
                              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>→</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#c0432b" }}>{ch.suggested_abbr}</span>
                              {ch.player_name && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{ch.player_name}</span>}
                              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginLeft: "auto", maxWidth: 80, textAlign: "right", lineHeight: 1.3 }}>{ch.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tactical tips */}
                    {aiRec.tactical_tips?.length > 0 && (
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Tips tácticos</p>
                        <div className="flex flex-col gap-1">
                          {aiRec.tactical_tips.map((tip: string, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#a78bfa", marginTop: 5, flexShrink: 0 }} />
                              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{tip}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Accept / Reject */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setAiRec(null)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.7)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <XCircle className="w-3.5 h-3.5" /> Rechazar
                      </button>
                      <button onClick={acceptRecommendation}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold"
                        style={{ background: "rgba(192,67,43,0.12)", color: "#c0432b", border: "1px solid rgba(192,67,43,0.3)" }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aplicar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Save Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {saveModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, backdropFilter: "blur(4px)" }}
              onClick={() => setSaveModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{   opacity: 0, scale: 0.94, y: 12  }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 60, width: 320, borderRadius: 18,
                background: "rgba(6,12,22,0.98)",
                border: "1px solid rgba(192,67,43,0.2)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.9)",
                padding: 24,
              }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background: "rgba(192,67,43,0.1)", border: "1px solid rgba(192,67,43,0.2)" }}>
                    <Save className="w-4 h-4" style={{ color: "#c0432b" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.95)" }}>Guardar jugada</p>
                    <p style={{ fontSize: 10, color: "rgba(192,67,43,0.6)", marginTop: 1 }}>{FORMATIONS[formKey].label} · {assignedCount}/11 jugadores</p>
                  </div>
                </div>
                <button onClick={() => setSaveModal(false)} style={{ color: "rgba(255,255,255,0.3)", lineHeight: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "white")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Input */}
              <div className="mb-5">
                <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  Nombre de la jugada
                </label>
                <input
                  autoFocus
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && saveName.trim()) saveMutation.mutate(saveName.trim()); }}
                  placeholder="Ej: Contraataque por derecha..."
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.9)", outline: "none", caretColor: "#c0432b", boxSizing: "border-box" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(192,67,43,0.4)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                />
              </div>

              {/* Info */}
              <div className="flex gap-2 mb-5">
                {[
                  { icon: Clock, label: "Formación", value: FORMATIONS[formKey].label },
                  { icon: UserCheck, label: "Jugadores", value: `${assignedCount}/11` },
                  { icon: Pencil, label: "Trazos", value: String(paths.length) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex-1 rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p style={{ fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>{value}</p>
                    <p style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={() => setSaveModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Cancelar
                </button>
                <button
                  onClick={() => saveName.trim() && saveMutation.mutate(saveName.trim())}
                  disabled={!saveName.trim() || saveMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: saveName.trim() ? "rgba(192,67,43,0.15)" : "rgba(255,255,255,0.04)", color: saveName.trim() ? "#c0432b" : "rgba(255,255,255,0.25)", border: `1px solid ${saveName.trim() ? "rgba(192,67,43,0.35)" : "rgba(255,255,255,0.08)"}`, cursor: saveName.trim() ? "pointer" : "not-allowed", transition: "all 0.15s" }}>
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saveMutation.isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
