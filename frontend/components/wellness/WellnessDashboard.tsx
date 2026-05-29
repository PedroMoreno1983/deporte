"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { wellnessApi, playersApi } from "@/lib/api";
import { useRealtime } from "@/lib/ws";
import {
  Moon, Zap, Smile, Activity, Brain,
  AlertTriangle, CheckCircle2, Plus, X, ChevronDown,
  TrendingUp, Users, HeartPulse, ClipboardList,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis,
} from "recharts";
import { GlowCard } from "@/components/ui/GlowCard";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TeamEntry {
  player_id: number;
  player_name: string;
  jersey_number: number | null;
  wellness_score: number | null;
  sleep_quality: number | null;
  fatigue: number | null;
  mood: number | null;
  muscle_soreness: number | null;
  stress: number | null;
  rpe_post: number | null;
  has_entry: boolean;
  alert: boolean;
}

interface TeamSummary {
  date: string;
  total_players: number;
  responded: number;
  avg_score: number | null;
  alerts: number;
  entries: TeamEntry[];
}

// ─── Metric config ────────────────────────────────────────────────────────────
const METRICS = [
  { key: "sleep_quality",   label: "Sueño",    icon: Moon,     color: "#818cf8", tip: "1 = muy mal • 10 = excelente" },
  { key: "fatigue",         label: "Energía",  icon: Zap,      color: "#f59e0b", tip: "1 = muy fatigado • 10 = sin fatiga" },
  { key: "mood",            label: "Ánimo",    icon: Smile,    color: "#00ff87", tip: "1 = muy bajo • 10 = excelente" },
  { key: "muscle_soreness", label: "Muscular", icon: Activity, color: "#f87171", tip: "1 = mucho dolor • 10 = sin dolor" },
  { key: "stress",          label: "Estrés",   icon: Brain,    color: "#a78bfa", tip: "1 = muy estresado • 10 = tranquilo" },
];

const SCORE_COLOR = (s: number | null) => {
  if (!s) return "rgba(255,255,255,0.2)";
  if (s >= 7.5) return "#00ff87";
  if (s >= 5)   return "#f59e0b";
  return "#ff3b30";
};

const SCORE_LABEL = (s: number | null) => {
  if (!s) return "—";
  if (s >= 7.5) return "Óptimo";
  if (s >= 5)   return "Moderado";
  return "Alerta";
};

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 48 }: { score: number | null; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score ? score / 10 : 0;
  const color = SCORE_COLOR(score);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease", filter: `drop-shadow(0 0 4px ${color}88)` }}
      />
    </svg>
  );
}

// ─── Metric slider ────────────────────────────────────────────────────────────
function MetricSlider({
  metric, value, onChange,
}: {
  metric: typeof METRICS[0];
  value: number;
  onChange: (v: number) => void;
}) {
  const Icon = metric.icon;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: metric.color }} />
          <span className="text-sm font-semibold text-white/80">{metric.label}</span>
        </div>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black"
          style={{ background: `${metric.color}22`, border: `1.5px solid ${metric.color}66`, color: metric.color }}
        >
          {value}
        </div>
      </div>
      <input
        type="range" min={1} max={10} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${metric.color} ${(value - 1) / 9 * 100}%, rgba(255,255,255,0.1) ${(value - 1) / 9 * 100}%)`,
          accentColor: metric.color,
        }}
      />
      <p className="text-[10px] text-white/25">{metric.tip}</p>
    </div>
  );
}

// ─── Wellness Form Modal ──────────────────────────────────────────────────────
function WellnessFormModal({
  open, onClose, preselectedPlayer,
}: {
  open: boolean;
  onClose: () => void;
  preselectedPlayer?: TeamEntry | null;
}) {
  const qc = useQueryClient();
  const { data: players = [] } = useQuery({ queryKey: ["players", "all"], queryFn: () => playersApi.list() });

  const [playerId, setPlayerId]   = useState<number | "">(preselectedPlayer?.player_id ?? "");
  const [showPicker, setShowPicker] = useState(false);
  const [values, setValues] = useState({ sleep_quality: 7, fatigue: 7, mood: 7, muscle_soreness: 7, stress: 7 });
  const [rpe, setRpe]       = useState<number | "">(7);
  const [notes, setNotes]   = useState("");

  const selectedPlayer = (players as any[]).find((p: any) => p.id === playerId);
  const today = new Date().toISOString().split("T")[0];

  const mutation = useMutation({
    mutationFn: (data: unknown) => wellnessApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-team"] });
      qc.invalidateQueries({ queryKey: ["wellness-trend"] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!playerId) return;
    mutation.mutate({
      player_id:       playerId,
      entry_date:      today,
      sleep_quality:   values.sleep_quality,
      fatigue:         values.fatigue,
      mood:            values.mood,
      muscle_soreness: values.muscle_soreness,
      stress:          values.stress,
      rpe_post:        rpe !== "" ? rpe : undefined,
      notes:           notes || undefined,
    });
  };

  const score = Object.values(values).reduce((a, b) => a + b, 0) / 5;
  const scoreColor = SCORE_COLOR(score);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.94, y: 12  }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "rgba(8,14,22,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <h2 className="text-base font-black text-white">Registrar Wellness</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <ScoreRing score={score} size={44} />
              <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 11, fontWeight: 900, color: scoreColor }}>
                {score.toFixed(1)}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Player selector */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 block">Jugador</label>
            <div className="relative">
              <button
                onClick={() => setShowPicker(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: selectedPlayer ? "white" : "rgba(255,255,255,0.3)" }}
              >
                {selectedPlayer ? `#${selectedPlayer.jersey_number ?? "—"} ${selectedPlayer.full_name}` : "Seleccionar jugador..."}
                <ChevronDown className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="absolute top-full mt-1 left-0 right-0 z-10 rounded-xl overflow-hidden max-h-48 overflow-y-auto"
                    style={{ background: "rgba(6,12,20,0.99)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}
                  >
                    {(players as any[]).map((p: any) => (
                      <button key={p.id} onClick={() => { setPlayerId(p.id); setShowPicker(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-white/[0.05] transition-colors"
                        style={{ color: p.id === playerId ? "#00ff87" : "rgba(255,255,255,0.8)" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
                          {p.jersey_number ?? "?"}
                        </div>
                        {p.full_name}
                        {p.id === playerId && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-neon" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Metrics */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 block">Estado hoy (1 → 10)</label>
            <div className="space-y-4">
              {METRICS.map(m => (
                <MetricSlider key={m.key} metric={m} value={(values as any)[m.key]}
                  onChange={v => setValues(prev => ({ ...prev, [m.key]: v }))} />
              ))}
            </div>
          </div>

          {/* RPE post */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 block">RPE post-entrenamiento <span className="text-white/25 font-normal">(opcional)</span></label>
            <div className="flex gap-2 flex-wrap">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setRpe(n === rpe ? "" : n)}
                  className="w-9 h-9 rounded-lg text-sm font-black transition-all"
                  style={{
                    background: rpe === n ? "rgba(0,255,135,0.15)" : "rgba(255,255,255,0.06)",
                    border: `1.5px solid ${rpe === n ? "rgba(0,255,135,0.6)" : "rgba(255,255,255,0.1)"}`,
                    color: rpe === n ? "#00ff87" : "rgba(255,255,255,0.5)",
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 block">Observaciones <span className="text-white/25 font-normal">(opcional)</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Comentarios adicionales..."
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", caretColor: "#00ff87" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={handleSubmit}
            disabled={!playerId || mutation.isPending}
            className="w-full py-2.5 rounded-xl text-sm font-black transition-all"
            style={{
              background: !playerId ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, rgba(0,255,135,0.25), rgba(0,255,135,0.12))",
              border: `1px solid ${!playerId ? "rgba(255,255,255,0.1)" : "rgba(0,255,135,0.4)"}`,
              color: !playerId ? "rgba(255,255,255,0.25)" : "#00ff87",
              cursor: !playerId ? "not-allowed" : "pointer",
            }}
          >
            {mutation.isPending ? "Guardando..." : "Guardar Wellness"}
          </button>
          {mutation.isError && <p className="text-xs text-red-400 text-center mt-2">Error al guardar. Intenta de nuevo.</p>}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function WellnessDashboard() {
  const qcMain = useQueryClient();
  const [modalOpen, setModalOpen]         = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<TeamEntry | null>(null);

  const { data: summary, isLoading } = useQuery<TeamSummary>({
    queryKey: ["wellness-team"],
    queryFn:  () => wellnessApi.teamSummary(),
    refetchInterval: 60_000,
  });

  const { data: trend = [] } = useQuery({
    queryKey: ["wellness-trend"],
    queryFn:  () => wellnessApi.teamTrend(14),
  });

  useRealtime("wellness", () => {
    qcMain.invalidateQueries({ queryKey: ["wellness-team"] });
    qcMain.invalidateQueries({ queryKey: ["wellness-trend"] });
  });

  const openForm = (player?: TeamEntry) => {
    setSelectedPlayer(player ?? null);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(0,255,135,0.4)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const responded  = summary?.responded    ?? 0;
  const total      = summary?.total_players ?? 0;
  const avgScore   = summary?.avg_score     ?? null;
  const alerts     = summary?.alerts        ?? 0;
  const entries    = summary?.entries       ?? [];
  const pct        = total > 0 ? Math.round((responded / total) * 100) : 0;

  // Radar data for team average
  const radarData = METRICS.map(m => ({
    metric: m.label,
    value: entries.filter(e => e.has_entry).length
      ? Math.round((entries.filter(e => e.has_entry).reduce((sum, e) => sum + ((e as any)[m.key] ?? 0), 0) / entries.filter(e => e.has_entry).length) * 10) / 10
      : 0,
    fullMark: 10,
  }));

  return (
    <>
      {/* ── KPI Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Score promedio */}
        <div className="glow-card rounded-xl">
          <div className="p-4 flex items-center gap-4">
            <div className="relative">
              <ScoreRing score={avgScore} size={52} />
              <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 13, fontWeight: 900, color: SCORE_COLOR(avgScore) }}>
                {avgScore?.toFixed(1) ?? "—"}
              </div>
            </div>
            <div>
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">Score equipo</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: SCORE_COLOR(avgScore) }}>{SCORE_LABEL(avgScore)}</p>
            </div>
          </div>
        </div>

        {/* Respuestas */}
        <div className="glow-card rounded-xl">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">Completaron</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-blue-400">{responded}</span>
              <span className="text-sm text-white/30">/ {total}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <motion.div className="h-full rounded-full bg-blue-400" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
            </div>
            <p className="text-xs text-white/30 mt-1">{pct}% del plantel</p>
          </div>
        </div>

        {/* Alertas */}
        <div className="glow-card rounded-xl">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {alerts > 0 ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">Alertas</p>
            </div>
            <span className="text-2xl font-black" style={{ color: alerts > 0 ? "#ff3b30" : "#00ff87" }}>{alerts}</span>
            <p className="text-xs text-white/30 mt-1">{alerts > 0 ? "jugadores en riesgo" : "plantel OK"}</p>
          </div>
        </div>

        {/* Sin reportar */}
        <div className="glow-card rounded-xl">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">Sin reportar</p>
            </div>
            <span className="text-2xl font-black text-amber-400">{total - responded}</span>
            <p className="text-xs text-white/30 mt-1">jugadores pendientes</p>
          </div>
        </div>
      </div>

      {/* ── Charts Row ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend chart */}
        <div className="lg:col-span-2 rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">Tendencia 14 días</p>
              <p className="text-sm font-bold text-white/80 mt-0.5">Score promedio del equipo</p>
            </div>
            <TrendingUp className="w-4 h-4 text-white/20" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={(trend as any[]).map(d => ({ ...d, date: d.date?.slice(5) }))}>
              <defs>
                <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#00ff87" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#00ff87" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: "rgba(6,12,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
                formatter={(v: any) => [v?.toFixed(2), "Score"]}
              />
              <Area dataKey="avg_score" stroke="#00ff87" strokeWidth={2} fill="url(#wGrad)" dot={false} activeDot={{ r: 4, fill: "#00ff87" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radar */}
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Perfil del equipo hoy</p>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
              <Radar dataKey="value" stroke="#00ff87" fill="#00ff87" fillOpacity={0.12} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Player Table ──────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Plantel</p>
            <p className="text-sm font-bold text-white/80 mt-0.5">Estado individual — hoy</p>
          </div>
          <button
            onClick={() => openForm()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.3)", color: "#00ff87" }}
          >
            <Plus className="w-3.5 h-3.5" /> Registrar
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_repeat(5,1fr)_1fr_1fr] gap-3 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/25">
            <span>Jugador</span>
            <span className="text-center">Score</span>
            {METRICS.map(m => <span key={m.key} className="text-center">{m.label}</span>)}
            <span className="text-center">RPE</span>
            <span></span>
          </div>

          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HeartPulse className="w-8 h-8 text-white/10 mb-3" />
              <p className="text-sm text-white/30">No hay jugadores registrados</p>
            </div>
          )}

          {entries.map((entry, i) => {
            const sc = entry.wellness_score;
            const col = SCORE_COLOR(sc);
            return (
              <motion.div
                key={entry.player_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-[2fr_1fr_repeat(5,1fr)_1fr_1fr] gap-3 px-5 py-3 items-center hover:bg-white/[0.02] transition-colors"
              >
                {/* Player */}
                <div className="flex items-center gap-2.5">
                  {entry.alert && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                  <div>
                    <p className="text-sm font-bold text-white/85 truncate">{entry.player_name}</p>
                    <p className="text-xs text-white/30">#{entry.jersey_number ?? "—"}</p>
                  </div>
                  {!entry.has_entry && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ml-1"
                      style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                      Pendiente
                    </span>
                  )}
                </div>

                {/* Score */}
                <div className="flex justify-center">
                  {entry.has_entry ? (
                    <div className="relative w-9 h-9">
                      <ScoreRing score={sc} size={36} />
                      <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 9, fontWeight: 900, color: col }}>
                        {sc?.toFixed(1)}
                      </div>
                    </div>
                  ) : <span className="text-white/20 text-xs">—</span>}
                </div>

                {/* Metrics */}
                {METRICS.map(m => (
                  <div key={m.key} className="flex justify-center">
                    {entry.has_entry ? (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                        style={{
                          background: `${m.color}18`,
                          border: `1.5px solid ${m.color}44`,
                          color: m.color,
                        }}
                      >
                        {(entry as any)[m.key] ?? "—"}
                      </div>
                    ) : <span className="text-white/15 text-xs">—</span>}
                  </div>
                ))}

                {/* RPE */}
                <div className="flex justify-center">
                  {entry.rpe_post != null
                    ? <span className="text-sm font-bold text-white/60">{entry.rpe_post}</span>
                    : <span className="text-white/15 text-xs">—</span>}
                </div>

                {/* Action */}
                <div className="flex justify-end">
                  <button
                    onClick={() => openForm(entry)}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg transition-colors"
                    style={{ color: entry.has_entry ? "rgba(255,255,255,0.25)" : "#00ff87", background: entry.has_entry ? "rgba(255,255,255,0.04)" : "rgba(0,255,135,0.08)", border: `1px solid ${entry.has_entry ? "rgba(255,255,255,0.08)" : "rgba(0,255,135,0.25)"}` }}
                  >
                    {entry.has_entry ? "Editar" : "Registrar"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <WellnessFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            preselectedPlayer={selectedPlayer}
          />
        )}
      </AnimatePresence>
    </>
  );
}
