"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useRef, useEffect } from "react";
import { matchesApi, playersApi, cvApi } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ArrowLeft, Trophy, Home, Plane, Plus, X, Loader2,
  Target, Zap, Shield, Footprints, Star, ChevronDown, ChevronUp,
  Timer, Flag, Film, Upload, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const inputCls = "w-full px-3 py-2 text-sm rounded-xl outline-none transition-all duration-200 focus:ring-2 focus:ring-[rgba(0,255,135,0.3)]";
const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
};
const labelCls = "text-[10px] font-semibold block mb-1 uppercase tracking-wider";

type StatForm = {
  player_id: string;
  minutes_played: string; started: boolean; rating: string;
  goals: string; assists: string; shots_total: string; shots_on_target: string; key_passes: string;
  passes_total: string; passes_completed: string;
  tackles: string; interceptions: string; clearances: string;
  fouls_committed: string; fouls_received: string;
  yellow_cards: string; red_cards: string;
  duels_total: string; duels_won: string; aerial_duels_total: string; aerial_duels_won: string;
  total_distance_m: string; high_intensity_distance_m: string; sprint_distance_m: string;
  max_speed_kmh: string; sprints_count: string; accelerations_count: string;
  notes: string;
};

const EMPTY_STAT: StatForm = {
  player_id: "", minutes_played: "90", started: true, rating: "",
  goals: "0", assists: "0", shots_total: "0", shots_on_target: "0", key_passes: "0",
  passes_total: "0", passes_completed: "0",
  tackles: "0", interceptions: "0", clearances: "0",
  fouls_committed: "0", fouls_received: "0",
  yellow_cards: "0", red_cards: "0",
  duels_total: "0", duels_won: "0", aerial_duels_total: "0", aerial_duels_won: "0",
  total_distance_m: "", high_intensity_distance_m: "", sprint_distance_m: "",
  max_speed_kmh: "", sprints_count: "", accelerations_count: "",
  notes: "",
};

function n(v: string, fallback = 0) {
  return v !== "" ? Number(v) : fallback;
}

function StatBadge({ value, label, color = "var(--text-secondary)" }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-base font-black" style={{ color }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{label}</p>
    </div>
  );
}

function RatingDot({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>;
  const color = rating >= 8 ? "#00ff87" : rating >= 6.5 ? "#f59e0b" : "#ff3b30";
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      {rating.toFixed(1)}
    </span>
  );
}

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const matchId = Number(id);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<StatForm>(EMPTY_STAT);
  const [showGps, setShowGps] = useState(false);

  const { data: match, isLoading: loadingMatch } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => matchesApi.get(matchId),
  });

  const { data: stats = [], isLoading: loadingStats } = useQuery({
    queryKey: ["match-stats", matchId],
    queryFn: () => matchesApi.getStats(matchId),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => playersApi.list(),
  });

  const addStatMutation = useMutation({
    mutationFn: () =>
      matchesApi.createStat({
        match_id: matchId,
        player_id: Number(form.player_id),
        minutes_played: n(form.minutes_played),
        started: form.started,
        rating: form.rating ? Number(form.rating) : null,
        goals: n(form.goals), assists: n(form.assists),
        shots_total: n(form.shots_total), shots_on_target: n(form.shots_on_target),
        key_passes: n(form.key_passes),
        passes_total: n(form.passes_total), passes_completed: n(form.passes_completed),
        tackles: n(form.tackles), interceptions: n(form.interceptions), clearances: n(form.clearances),
        fouls_committed: n(form.fouls_committed), fouls_received: n(form.fouls_received),
        yellow_cards: n(form.yellow_cards), red_cards: n(form.red_cards),
        duels_total: n(form.duels_total), duels_won: n(form.duels_won),
        aerial_duels_total: n(form.aerial_duels_total), aerial_duels_won: n(form.aerial_duels_won),
        total_distance_m: form.total_distance_m ? Number(form.total_distance_m) : null,
        high_intensity_distance_m: form.high_intensity_distance_m ? Number(form.high_intensity_distance_m) : null,
        sprint_distance_m: form.sprint_distance_m ? Number(form.sprint_distance_m) : null,
        max_speed_kmh: form.max_speed_kmh ? Number(form.max_speed_kmh) : null,
        sprints_count: form.sprints_count ? Number(form.sprints_count) : null,
        accelerations_count: form.accelerations_count ? Number(form.accelerations_count) : null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match-stats", matchId] });
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      toast.success("Estadística registrada");
      setForm(EMPTY_STAT);
      setShowForm(false);
    },
    onError: () => toast.error("Error al guardar la estadística"),
  });

  const set = (k: keyof StatForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Derived totals from all stats
  const totals = (stats as any[]).reduce(
    (acc: any, s: any) => ({
      goals: acc.goals + (s.goals ?? 0),
      assists: acc.assists + (s.assists ?? 0),
      shots: acc.shots + (s.shots_total ?? 0),
      passes: acc.passes + (s.passes_total ?? 0),
      tackles: acc.tackles + (s.tackles ?? 0),
      yellows: acc.yellows + (s.yellow_cards ?? 0),
      reds: acc.reds + (s.red_cards ?? 0),
    }),
    { goals: 0, assists: 0, shots: 0, passes: 0, tackles: 0, yellows: 0, reds: 0 }
  );

  // Registered player IDs so we don't double-add
  const registeredIds = new Set((stats as any[]).map((s: any) => s.player_id));
  const availablePlayers = (players as any[]).filter((p: any) => !registeredIds.has(p.id));

  if (loadingMatch) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--neon)" }} />
    </div>
  );

  const won = match?.goals_for != null && match?.goals_against != null && match.goals_for > match.goals_against;
  const lost = match?.goals_for != null && match?.goals_against != null && match.goals_for < match.goals_against;
  const draw = match?.goals_for != null && match?.goals_against != null && match.goals_for === match.goals_against;
  const resultColor = won ? "#00ff87" : lost ? "#ff3b30" : "#f59e0b";

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pl-12 lg:pl-0">
        <PageHeader
          icon={Trophy}
          title={match?.opponent ? `vs ${match.opponent}` : "Detalle partido"}
          description={`${match?.date ?? ""} · ${match?.competition ?? "Sin competencia"}`}
          iconColor="text-yellow-400"
          iconBg="bg-yellow-500/10 border-yellow-500/20"
          className="mb-0 flex-1"
        />
        <div className="flex items-center gap-2 shrink-0">
          {match?.id != null && (
            <Link href={`/matches/${match.id}/analytics`}>
              <button
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-colors"
                style={{ color: "#00ff87", background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.25)" }}
              >
                <Target className="w-3.5 h-3.5" />
                Analítica
              </button>
            </Link>
          )}
          <Link href="/matches">
            <button
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-colors"
              style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Partidos
            </button>
          </Link>
        </div>
      </div>

      {/* ── Scoreboard hero ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <GlowCard className="p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Home / Away badge */}
            <div className="flex items-center gap-2">
              {match?.is_home ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "rgba(14,165,233,0.12)", color: "#0ea5e9" }}>
                  <Home className="w-3.5 h-3.5" /> Local
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7" }}>
                  <Plane className="w-3.5 h-3.5" /> Visitante
                </span>
              )}
              {match?.competition && (
                <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                  {match.competition}
                </span>
              )}
            </div>

            {/* Score */}
            {match?.goals_for != null && match?.goals_against != null ? (
              <div className="text-center">
                <div className="flex items-center gap-3">
                  <span
                    className="text-5xl font-black tabular-nums"
                    style={{ color: resultColor, textShadow: `0 0 30px ${resultColor}60` }}
                  >
                    {match.goals_for}
                  </span>
                  <span className="text-2xl font-bold opacity-30">—</span>
                  <span
                    className="text-5xl font-black tabular-nums"
                    style={{ color: lost ? "#00ff87" : won ? "#ff3b30" : "#f59e0b", opacity: 0.7 }}
                  >
                    {match.goals_against}
                  </span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: resultColor }}>
                  {won ? "Victoria" : lost ? "Derrota" : "Empate"}
                </p>
              </div>
            ) : (
              <p className="text-2xl font-black opacity-20">vs {match?.opponent}</p>
            )}

            {/* Team totals row */}
            <div className="flex items-center gap-5">
              <StatBadge value={totals.goals} label="Goles" color="var(--neon)" />
              <StatBadge value={totals.assists} label="Asist." />
              <StatBadge value={totals.shots} label="Tiros" />
              <StatBadge value={totals.yellows} label="TA" color="#f59e0b" />
              <StatBadge value={totals.reds} label="TR" color="#ff3b30" />
            </div>
          </div>
        </GlowCard>
      </motion.div>

      {/* ── Add stat button ── */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
          Estadísticas individuales
          <span className="ml-2 text-xs font-normal opacity-40">({(stats as any[]).length} jugadores)</span>
        </h2>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: "var(--neon)", color: "#000", boxShadow: "0 0 16px rgba(0,255,135,0.35)" }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Agregar estadística</span>
          <span className="sm:hidden">Agregar</span>
        </motion.button>
      </div>

      {/* ── Form ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <GlowCard className="p-5 rounded-2xl space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Nueva estadística</p>
                <button onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                </button>
              </div>

              {/* Player + base */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Jugador *</label>
                  <select value={form.player_id} onChange={set("player_id")} className={inputCls} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">Seleccionar...</option>
                    {availablePlayers.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name} {p.jersey_number ? `#${p.jersey_number}` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Minutos</label>
                  <input type="number" min={0} max={120} value={form.minutes_played} onChange={set("minutes_played")} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Titular</label>
                  <select value={form.started ? "true" : "false"} onChange={e => setForm(f => ({ ...f, started: e.target.value === "true" }))} className={inputCls} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              {/* Ofensivo */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(0,255,135,0.6)" }}>Ataque</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {[
                    { label: "Goles", k: "goals" },
                    { label: "Asistencias", k: "assists" },
                    { label: "Tiros tot.", k: "shots_total" },
                    { label: "Tiros al arco", k: "shots_on_target" },
                    { label: "Pases clave", k: "key_passes" },
                    { label: "Rating", k: "rating" },
                  ].map(({ label, k }) => (
                    <div key={k}>
                      <label className={labelCls} style={{ color: "var(--text-secondary)" }}>{label}</label>
                      <input type="number" min={0} step={k === "rating" ? "0.1" : "1"} max={k === "rating" ? "10" : undefined} value={(form as any)[k]} onChange={set(k as keyof StatForm)} className={inputCls} style={inputStyle} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Pases */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(14,165,233,0.7)" }}>Pases</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Pases tot.", k: "passes_total" },
                    { label: "Pases ok", k: "passes_completed" },
                    { label: "Duelos tot.", k: "duels_total" },
                    { label: "Duelos ganados", k: "duels_won" },
                  ].map(({ label, k }) => (
                    <div key={k}>
                      <label className={labelCls} style={{ color: "var(--text-secondary)" }}>{label}</label>
                      <input type="number" min={0} value={(form as any)[k]} onChange={set(k as keyof StatForm)} className={inputCls} style={inputStyle} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Defensivo */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(249,115,22,0.7)" }}>Defensa & Disciplina</p>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
                  {[
                    { label: "Entradas", k: "tackles" },
                    { label: "Intercepciones", k: "interceptions" },
                    { label: "Despejes", k: "clearances" },
                    { label: "Faltas com.", k: "fouls_committed" },
                    { label: "Faltas rec.", k: "fouls_received" },
                    { label: "T. Amarilla", k: "yellow_cards" },
                    { label: "T. Roja", k: "red_cards" },
                  ].map(({ label, k }) => (
                    <div key={k}>
                      <label className={labelCls} style={{ color: "var(--text-secondary)" }}>{label}</label>
                      <input type="number" min={0} value={(form as any)[k]} onChange={set(k as keyof StatForm)} className={inputCls} style={inputStyle} />
                    </div>
                  ))}
                </div>
              </div>

              {/* GPS Toggle */}
              <button
                onClick={() => setShowGps(v => !v)}
                className="flex items-center gap-2 text-xs font-semibold transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                {showGps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Datos GPS (opcional)
              </button>

              {showGps && (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Dist. total (m)", k: "total_distance_m" },
                      { label: "Dist. alta int. (m)", k: "high_intensity_distance_m" },
                      { label: "Dist. sprint (m)", k: "sprint_distance_m" },
                      { label: "Vel. máx (km/h)", k: "max_speed_kmh" },
                      { label: "Sprints (#)", k: "sprints_count" },
                      { label: "Aceleraciones (#)", k: "accelerations_count" },
                    ].map(({ label, k }) => (
                      <div key={k}>
                        <label className={labelCls} style={{ color: "var(--text-secondary)" }}>{label}</label>
                        <input type="number" min={0} step="0.1" value={(form as any)[k]} onChange={set(k as keyof StatForm)} placeholder="—" className={inputCls} style={inputStyle} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Notas</label>
                <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Observaciones..." className={`${inputCls} resize-none`} style={inputStyle} />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowForm(false); setForm(EMPTY_STAT); }} className="px-4 py-2 rounded-xl text-sm" style={{ color: "var(--text-muted)" }}>
                  Cancelar
                </button>
                <button
                  onClick={() => addStatMutation.mutate()}
                  disabled={!form.player_id || addStatMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "var(--neon)", color: "#000" }}
                >
                  {addStatMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Guardar
                </button>
              </div>
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats table ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <GlowCard className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Jugador", "Min", "Goles", "Asist.", "Tiros", "Pases%", "Entradas", "TA/TR", "Rating"].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingStats ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                      Cargando estadísticas...
                    </td>
                  </tr>
                ) : !(stats as any[]).length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center">
                      <div
                        className="inline-flex p-4 rounded-2xl mb-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}
                      >
                        <Trophy className="w-6 h-6 opacity-20" style={{ color: "var(--neon)" }} />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Sin estadísticas registradas</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Usa el botón "Agregar estadística" para registrar el rendimiento de cada jugador</p>
                    </td>
                  </tr>
                ) : (
                  (stats as any[]).map((s: any, i: number) => {
                    const player = (players as any[]).find((p: any) => p.id === s.player_id);
                    const name = player ? `${player.first_name} ${player.last_name}` : `Jugador #${s.player_id}`;
                    const passAcc = s.passes_total > 0
                      ? `${Math.round((s.passes_completed / s.passes_total) * 100)}%`
                      : "—";
                    return (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="px-4 py-3">
                          <Link href={`/players/${s.player_id}`} className="font-semibold hover:underline" style={{ color: "var(--text-primary)" }}>
                            {name}
                          </Link>
                          {s.started && (
                            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,255,135,0.1)", color: "var(--neon)" }}>
                              TIT
                            </span>
                          )}
                          {player?.jersey_number && (
                            <span className="ml-1 text-[9px] opacity-40">#{player.jersey_number}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{s.minutes_played}'</td>
                        <td className="px-4 py-3 font-bold tabular-nums" style={{ color: s.goals > 0 ? "var(--neon)" : "var(--text-muted)" }}>
                          {s.goals ?? 0}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: s.assists > 0 ? "#a78bfa" : "var(--text-muted)" }}>
                          {s.assists ?? 0}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>
                          {s.shots_on_target ?? 0}/{s.shots_total ?? 0}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-xs" style={{ color: "var(--text-secondary)" }}>
                          {passAcc}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>
                          {s.tackles ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          {(s.yellow_cards > 0 || s.red_cards > 0) ? (
                            <div className="flex gap-1">
                              {Array.from({ length: s.yellow_cards ?? 0 }).map((_,i) => (
                                <span key={i} className="w-2.5 h-3.5 rounded-[2px] inline-block" style={{ background: "#f59e0b" }} />
                              ))}
                              {Array.from({ length: s.red_cards ?? 0 }).map((_,i) => (
                                <span key={i} className="w-2.5 h-3.5 rounded-[2px] inline-block" style={{ background: "#ff3b30" }} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs opacity-20">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <RatingDot rating={s.rating} />
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlowCard>
      </motion.div>

      {/* ── GPS section (if any player has GPS data) ── */}
      {(stats as any[]).some((s: any) => s.total_distance_m) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-secondary)" }}>
            Datos GPS
          </h3>
          <GlowCard className="rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Jugador", "Dist. total", "Alta int.", "Sprint", "Vel. máx", "Sprints #"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stats as any[]).filter((s: any) => s.total_distance_m).map((s: any, i) => {
                    const player = (players as any[]).find((p: any) => p.id === s.player_id);
                    const name = player ? `${player.first_name} ${player.last_name}` : `#${s.player_id}`;
                    return (
                      <tr
                        key={s.id}
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>{name}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--neon)" }}>
                          {s.total_distance_m ? `${(s.total_distance_m / 1000).toFixed(2)} km` : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                          {s.high_intensity_distance_m ? `${s.high_intensity_distance_m.toFixed(0)} m` : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                          {s.sprint_distance_m ? `${s.sprint_distance_m.toFixed(0)} m` : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-bold" style={{ color: "#f97316" }}>
                          {s.max_speed_kmh ? `${s.max_speed_kmh.toFixed(1)} km/h` : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>
                          {s.sprints_count ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlowCard>
        </motion.div>
      )}

      {/* ── Video Analysis IA (CV) ── */}
      <CVMatchSection matchId={matchId} players={players as any[]} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * CV Match Section — loads video clips linked to this match, aggregates
 * physical stats per jersey across all clips, and lets the user sync
 * the aggregated GPS data into official match stats.
 * ────────────────────────────────────────────────────────────────────── */

function CVMatchSection({ matchId, players }: { matchId: number; players: any[] }) {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [selectedLooseClipId, setSelectedLooseClipId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All video analyses linked to this match
  const { data: clips = [], isLoading: loadingClips } = useQuery<any[]>({
    queryKey: ["cv-match", matchId],
    queryFn: () => cvApi.list({ match_id: matchId }),
  });

  // All video analyses to find loose ones
  const { data: allClips = [] } = useQuery<any[]>({
    queryKey: ["cv-all"],
    queryFn: () => cvApi.list(),
  });

  const looseClips = useMemo(() => {
    return allClips.filter((c: any) => c.match_id === null || c.match_id === undefined);
  }, [allClips]);

  // Load full results for each "done" clip
  const doneClips = clips.filter((c: any) => c.status === "done");
  const doneIds = doneClips.map((c: any) => c.id).sort().join(",");

  const { data: clipDetails = [] } = useQuery<any[]>({
    queryKey: ["cv-match-details", doneIds],
    queryFn: async () => {
      if (!doneClips.length) return [];
      return Promise.all(doneClips.map((c: any) => cvApi.get(c.id)));
    },
    enabled: doneClips.length > 0,
  });

  // Local overrides and scale factor calibration
  const [scaleFactor, setScaleFactor] = useState<number>(0.65);
  const [overrides, setOverrides] = useState<Record<number, { team?: number | null; playerId?: number | null }>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`cv-match-overrides-${matchId}`);
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  const saveOverrides = (newOverrides: typeof overrides) => {
    setOverrides(newOverrides);
    localStorage.setItem(`cv-match-overrides-${matchId}`, JSON.stringify(newOverrides));
  };

  // Find white team BGR color centroids
  const parsedTeamColors = useMemo(() => {
    for (const detail of clipDetails) {
      const tc = detail?.results?.team_colors;
      if (tc && tc.length >= 2) {
        return tc as [[number, number, number], [number, number, number]];
      }
    }
    return null;
  }, [clipDetails]);

  const whiteTeamIndex = useMemo(() => {
    if (!parsedTeamColors) return null;
    const colorDistanceToWhite = (bgr: [number, number, number]) => {
      const r = bgr[2];
      const g = bgr[1];
      const b = bgr[0];
      return Math.sqrt((r - 255) ** 2 + (g - 255) ** 2 + (b - 255) ** 2);
    };
    const d0 = colorDistanceToWhite(parsedTeamColors[0]);
    const d1 = colorDistanceToWhite(parsedTeamColors[1]);
    return d0 < d1 ? 0 : 1;
  }, [parsedTeamColors]);

  const getTeamDisplayName = (teamVal: string | number | null) => {
    if (teamVal == null) return "Sin asignar";
    const idx = (teamVal === "A" || teamVal === 0 || teamVal === "0") ? 0 : 1;
    if (whiteTeamIndex === null) {
      return idx === 0 ? "Equipo A" : "Equipo B";
    }
    return idx === whiteTeamIndex ? "Petroleros (Blanco)" : "Beauchef SS (Rival)";
  };

  const getTeamColorStyle = (teamVal: string | number | null) => {
    if (teamVal == null || !parsedTeamColors) return {};
    const idx = (teamVal === "A" || teamVal === 0 || teamVal === "0") ? 0 : 1;
    const bgr = parsedTeamColors[idx];
    const rgbStr = `rgb(${bgr[2]}, ${bgr[1]}, ${bgr[0]})`;
    return { backgroundColor: rgbStr };
  };

  // Aggregate identities/tracks across all clips by jersey number
  const aggregated = useMemo(() => {
    const byJersey = new Map<number, { jersey: number; distance_m: number; max_speed_kmh: number; clipIds: Set<number>; team: string | number | null }>();

    for (const detail of clipDetails) {
      const idents = detail?.results?.identities;
      const rows = idents && idents.length > 0
        ? idents
        : (detail?.results?.tracks ?? []).filter((t: any) => (t.total_distance_m ?? t.distance_m ?? 0) >= 5);

      for (const row of rows) {
        const jersey = row.jersey ?? row.jersey_number ?? null;
        if (jersey == null) continue;

        const dist = (row.distance_m ?? row.total_distance_m ?? 0) * scaleFactor;
        const speed = (row.top_speed_kmh ?? row.max_speed_kmh ?? row.speed_kmh ?? 0) * scaleFactor;
        
        // Apply team override
        let team = row.team ?? null;
        const ovr = overrides[jersey];
        if (ovr && ovr.team !== undefined && ovr.team !== null) {
          team = ovr.team;
        }

        const existing = byJersey.get(jersey);
        if (existing) {
          existing.distance_m += dist;
          existing.max_speed_kmh = Math.max(existing.max_speed_kmh, speed);
          existing.clipIds.add(detail.id);
          if (existing.team == null && team != null) {
            existing.team = team;
          }
        } else {
          byJersey.set(jersey, { jersey, distance_m: dist, max_speed_kmh: speed, clipIds: new Set([detail.id]), team });
        }
      }
    }

    // Apply team overrides to the aggregated list as well to be sure
    byJersey.forEach((row) => {
      const ovr = overrides[row.jersey];
      if (ovr && ovr.team !== undefined && ovr.team !== null) {
        row.team = ovr.team;
      }
    });

    return Array.from(byJersey.values())
      .map(row => ({
        jersey: row.jersey,
        distance_m: row.distance_m,
        max_speed_kmh: row.max_speed_kmh,
        clips: row.clipIds.size,
        team: row.team
      }))
      .sort((a, b) => b.distance_m - a.distance_m);
  }, [clipDetails, overrides, scaleFactor]);

  // Map jersey → player from the DB
  const jerseyToPlayer = useMemo(() => {
    const m = new Map<number, any>();
    for (const p of players) {
      if (p.jersey_number != null) m.set(p.jersey_number, p);
    }
    return m;
  }, [players]);

  const getPlayerForRow = (jersey: number) => {
    const ovr = overrides[jersey];
    if (ovr && ovr.playerId !== undefined) {
      if (ovr.playerId === null) return null;
      return players.find(p => p.id === ovr.playerId) || null;
    }
    return jerseyToPlayer.get(jersey) || null;
  };

  const [teamFilter, setTeamFilter] = useState<"all" | 0 | 1>("all");

  useEffect(() => {
    if (whiteTeamIndex !== null) {
      setTeamFilter(whiteTeamIndex);
    }
  }, [whiteTeamIndex]);

  const filteredAggregated = useMemo(() => {
    if (teamFilter === "all") return aggregated;
    return aggregated.filter((row) => {
      if (row.team == null) return false;
      const idx = (row.team === "A" || row.team === 0 || row.team === "0") ? 0 : 1;
      return idx === teamFilter;
    });
  }, [aggregated, teamFilter]);

  const handleLinkClip = async (clipId: number) => {
    try {
      await cvApi.update(clipId, { match_id: matchId });
      toast.success("Clip vinculado con éxito.");
      setSelectedLooseClipId(null);
      qc.invalidateQueries({ queryKey: ["cv-match", matchId] });
      qc.invalidateQueries({ queryKey: ["cv-all"] });
    } catch {
      toast.error("Error al vincular el clip.");
    }
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await cvApi.upload(file, { match_id: matchId });
      toast.success("Video subido con éxito. El análisis ha comenzado en segundo plano.");
      qc.invalidateQueries({ queryKey: ["cv-match", matchId] });
      qc.invalidateQueries({ queryKey: ["cv-all"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al subir el video.");
    } finally {
      setUploading(false);
    }
  };

  const handleSyncStats = async () => {
    if (!aggregated.length) return;
    setSyncing(true);
    let ok = 0;
    let fail = 0;
    for (const row of aggregated) {
      const player = getPlayerForRow(row.jersey);
      if (!player) continue;
      try {
        await matchesApi.createStat({
          match_id: matchId,
          player_id: player.id,
          minutes_played: 0,
          started: false,
          total_distance_m: Math.round(row.distance_m),
          max_speed_kmh: Math.round(row.max_speed_kmh * 10) / 10,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setSyncing(false);
    if (ok > 0) {
      toast.success(`${ok} estadísticas GPS sincronizadas desde video.`);
      qc.invalidateQueries({ queryKey: ["match-stats", matchId] });
    }
    if (fail > 0) toast.error(`${fail} fallaron al sincronizar.`);
  };

  if (loadingClips) return null;

  const statusMeta: Record<string, { color: string; label: string; Icon: any }> = {
    pending:    { color: "var(--text-muted)",  label: "en cola",    Icon: Clock },
    processing: { color: "#f59e0b",           label: "procesando", Icon: Loader2 },
    done:       { color: "#00ff87",            label: "listo",      Icon: CheckCircle2 },
    failed:     { color: "#ff3b30",            label: "falló",      Icon: X },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
        <Film className="w-4 h-4" style={{ color: "#a78bfa" }} />
        Análisis de Video IA (CV)
        <span className="text-xs font-normal opacity-40 ml-1">{clips.length} clip{clips.length !== 1 ? "s" : ""}</span>
      </h3>

      {/* Clip list or empty state */}
      {clips.length === 0 ? (
        <div className="p-8 text-center text-white/50 border border-dashed border-white/10 rounded-2xl mb-4 bg-white/[0.01]">
          <Film className="w-8 h-8 mx-auto mb-2 text-white/20" />
          <p className="text-sm font-semibold text-white/80">No hay clips de video vinculados a este partido</p>
          <p className="text-xs text-white/40 mt-0.5">Sube un video o vincula un análisis existente para comenzar</p>
        </div>
      ) : (
        <GlowCard className="rounded-2xl overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Clip", "Duración", "Estado", "Subido"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clips.map((c: any) => {
                  const meta = statusMeta[c.status] ?? statusMeta.pending;
                  const { Icon } = meta;
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                        <Film className="w-3.5 h-3.5 inline-block mr-1.5 -translate-y-0.5" style={{ color: meta.color }} />
                        <Link href={`/cv/${c.id}`} className="hover:underline hover:text-[#00ff87] transition-all">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {c.duration_s != null ? `${Math.floor(c.duration_s / 60)}:${String(Math.floor(c.duration_s % 60)).padStart(2, "0")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: meta.color }}>
                          <Icon className={"w-3 h-3" + (c.status === "processing" ? " animate-spin" : "")} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(c.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlowCard>
      )}

      {/* Upload & Link controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Upload Control */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Subir nuevo video de partido</h4>
            <p className="text-[11px] text-white/50 mt-1">
              Sube un archivo de video (MP4, MOV, AVI) para iniciar el análisis automático y asociarlo a este partido.
            </p>
          </div>
          <div>
            <input
              type="file"
              accept="video/*"
              ref={fileInputRef}
              onChange={handleUploadVideo}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary w-full text-xs py-2 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? "Subiendo..." : "Seleccionar y subir video"}
            </button>
          </div>
        </div>

        {/* Link Control */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Vincular análisis existente</h4>
            <p className="text-[11px] text-white/50 mt-1">
              Si ya procesaste videos sueltos (sin partido), puedes seleccionarlos aquí para vincularlos a este partido.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedLooseClipId || ""}
              onChange={(e) => setSelectedLooseClipId(e.target.value ? Number(e.target.value) : null)}
              className="bg-white/[0.04] border border-white/10 text-xs px-3 py-2 rounded-xl flex-1 text-white outline-none focus:ring-1 focus:ring-[#00ff87]/30"
            >
              <option value="" className="bg-[#18181b]">-- Seleccionar clip suelto --</option>
              {looseClips.map((c: any) => (
                <option key={c.id} value={c.id} className="bg-[#18181b]">
                  {c.name} ({new Date(c.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
            <button
              onClick={() => selectedLooseClipId && handleLinkClip(selectedLooseClipId)}
              disabled={!selectedLooseClipId}
              className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-50 shrink-0"
            >
              Vincular
            </button>
          </div>
        </div>
      </div>

      {/* Excel player roster note */}
      <p className="text-[11px] text-white/30 mb-6 text-center">
        * ¿No se reconocen los nombres de los jugadores? Mapea los números de camiseta importando el Excel del plantel en la sección de <Link href="/players" className="underline hover:text-[#00ff87]">Jugadores</Link>.
      </p>

      {/* Aggregated physical stats */}
      {aggregated.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
              Métricas físicas agregadas (CV)
              <span className="text-xs font-normal opacity-40 ml-2">{aggregated.length} jugadores detectados · {doneClips.length} clips procesados</span>
            </h4>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleSyncStats}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Cargar a estadísticas oficiales
            </motion.button>
          </div>

          {/* Team Filter Tabs & Camera Scale Calibration */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3 border-b border-white/5 pb-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTeamFilter("all")}
                className={`chip ${teamFilter === "all" ? "is-on" : ""}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                Todos ({aggregated.length})
              </button>
              <button
                onClick={() => setTeamFilter(0)}
                className={`chip ${teamFilter === 0 ? "is-on" : ""}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                <span className="w-2 h-2 rounded-full inline-block mr-1.5 align-middle" style={{ ...getTeamColorStyle(0), border: "1px solid rgba(255,255,255,0.2)" }} />
                <span className="align-middle">{getTeamDisplayName(0)} ({aggregated.filter(r => (r.team === "A" || r.team === 0 || r.team === "0")).length})</span>
              </button>
              <button
                onClick={() => setTeamFilter(1)}
                className={`chip ${teamFilter === 1 ? "is-on" : ""}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                <span className="w-2 h-2 rounded-full inline-block mr-1.5 align-middle" style={{ ...getTeamColorStyle(1), border: "1px solid rgba(255,255,255,0.2)" }} />
                <span className="align-middle">{getTeamDisplayName(1)} ({aggregated.filter(r => (r.team === "B" || r.team === 1 || r.team === "1")).length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-white/50">Ajuste de Zoom / Escala:</span>
              <select
                value={scaleFactor}
                onChange={(e) => setScaleFactor(Number(e.target.value))}
                className="bg-white/[0.04] border border-white/10 text-[11px] px-2 py-1 rounded-lg text-white/70 outline-none focus:ring-1 focus:ring-purple-500/30"
              >
                <option value={1.0} className="bg-[#18181b]">Cancha Completa (1.0x)</option>
                <option value={0.8} className="bg-[#18181b]">Plano Medio (0.8x)</option>
                <option value={0.65} className="bg-[#18181b]">Repeticiones / Highlights (0.65x)</option>
                <option value={0.5} className="bg-[#18181b]">Zoom Corto (0.5x)</option>
              </select>
            </div>
          </div>

          <GlowCard className="rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Dorsal", "Camiseta / Equipo", "Jugador", "Distancia Total", "Vel. Máxima", "Clips"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAggregated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-xs text-white/30 italic">
                        No hay jugadores detectados para esta selección.
                      </td>
                    </tr>
                  ) : (
                    filteredAggregated.map((row) => {
                      const player = getPlayerForRow(row.jersey);
                      const name = player ? `${player.first_name} ${player.last_name}` : null;
                      return (
                        <tr
                          key={row.jersey}
                          style={{ borderBottom: "1px solid var(--border-subtle)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-4 py-3 font-black tabular-nums" style={{ color: "#a78bfa" }}>#{row.jersey}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="w-2.5 h-2.5 rounded-full inline-block mr-1.5 align-middle" style={{ ...getTeamColorStyle(row.team), border: "1px solid rgba(255,255,255,0.2)" }} />
                            <select
                              value={row.team ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const newOvr = {
                                  ...overrides,
                                  [row.jersey]: {
                                    ...overrides[row.jersey],
                                    team: val === "" ? null : Number(val)
                                  }
                                };
                                saveOverrides(newOvr);
                                toast.success("Equipo modificado para dorsal #" + row.jersey);
                              }}
                              className="bg-transparent border-none text-xs font-semibold text-white/70 outline-none cursor-pointer hover:text-white transition-all align-middle"
                            >
                              <option value={0} className="bg-[#18181b]">{getTeamDisplayName(0)}</option>
                              <option value={1} className="bg-[#18181b]">{getTeamDisplayName(1)}</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={player?.id ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const newOvr = {
                                  ...overrides,
                                  [row.jersey]: {
                                    ...overrides[row.jersey],
                                    playerId: val === "" ? null : Number(val)
                                  }
                                };
                                saveOverrides(newOvr);
                                toast.success(val === "" ? "Desvinculado para este partido" : "Mapeo guardado para este partido");
                              }}
                              className="bg-white/[0.04] border border-white/10 text-xs px-2 py-1 rounded-lg text-white/70 outline-none max-w-[220px] cursor-pointer"
                            >
                              <option value="" className="bg-[#18181b]">-- No jugó / Sin asignar --</option>
                              {players.map((p: any) => (
                                <option key={p.id} value={p.id} className="bg-[#18181b]">
                                  {p.first_name} {p.last_name} {p.jersey_number ? `(#${p.jersey_number})` : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 tabular-nums font-bold" style={{ color: "var(--neon)" }}>
                            {(row.distance_m / 1000).toFixed(2)} km
                          </td>
                          <td className="px-4 py-3 tabular-nums font-bold" style={{ color: "#f97316" }}>
                            {row.max_speed_kmh.toFixed(1)} km/h
                          </td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>
                            {row.clips}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlowCard>
        </>
      )}
    </motion.div>
  );
}
