"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { trainingApi, playersApi } from "@/lib/api";
import { useState } from "react";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Dumbbell, Plus, ChevronDown, X, Loader2, TrendingUp, Zap, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, LineChart, Line, Legend,
} from "recharts";

const SESSION_TYPES = [
  { value: "training",  label: "Entrenamiento", color: "#00ff87" },
  { value: "match",     label: "Partido",       color: "#f59e0b" },
  { value: "gym",       label: "Gimnasio",       color: "#a855f7" },
  { value: "recovery",  label: "Recuperación",   color: "#0ea5e9" },
];

const ACWR_ZONES = [
  { min: 0,    max: 0.8,  label: "Sub-carga",    color: "#0ea5e9" },
  { min: 0.8,  max: 1.3,  label: "Zona óptima",  color: "#00ff87" },
  { min: 1.3,  max: 1.5,  label: "Precaución",   color: "#f59e0b" },
  { min: 1.5,  max: 99,   label: "Zona de riesgo", color: "#ff3b30" },
];

function getZone(acwr?: number | null) {
  if (!acwr) return ACWR_ZONES[0];
  return ACWR_ZONES.find(z => acwr >= z.min && acwr < z.max) ?? ACWR_ZONES[3];
}

const inputCls = "w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all focus:ring-2 focus:ring-[rgba(0,255,135,0.3)]";
const inputStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border-medium)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-bold" style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}</p>
      ))}
    </div>
  );
};

export default function TrainingPage() {
  const qc = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    session_date: new Date().toISOString().split("T")[0],
    session_type: "training",
    duration_minutes: "90",
    rpe: "6",
    total_distance_m: "",
  });

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: sessions = [] } = useQuery({
    queryKey: ["training", selectedPlayer],
    queryFn: () => selectedPlayer ? trainingApi.getByPlayer(selectedPlayer) : Promise.resolve([]),
    enabled: !!selectedPlayer,
  });

  const createSession = useMutation({
    mutationFn: (data: unknown) => trainingApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training", selectedPlayer] });
      setShowForm(false);
      setForm({ session_date: new Date().toISOString().split("T")[0], session_type: "training", duration_minutes: "90", rpe: "6", total_distance_m: "" });
      toast.success("Sesión registrada");
    },
    onError: () => toast.error("Error al registrar sesión"),
  });

  const lastSession = (sessions as any[])[0];
  const acwrValue = lastSession?.acwr;
  const zone = getZone(acwrValue);
  const selectedPlayerData = (players as any[]).find((p: any) => p.id === selectedPlayer);

  const chartData = [...(sessions as any[])].reverse().slice(-30).map((s: any) => ({
    date: s.session_date?.slice(5) ?? "",
    load: s.session_load ?? 0,
    acwr: s.acwr ? +s.acwr.toFixed(2) : null,
    acute: s.acute_load ?? 0,
    chronic: s.chronic_load ?? 0,
  }));

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] as any },
  });

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          icon={Dumbbell}
          title="Entrenamiento"
          description="Carga de trabajo y ACWR por jugador"
          iconColor="text-orange-400"
          iconBg="bg-orange-500/10 border-orange-500/20"
          className="pl-10 sm:pl-12 lg:pl-0 mb-0 flex-1"
        />
        {selectedPlayer && (
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--neon)", color: "#000", boxShadow: "0 0 20px rgba(0,255,135,0.3)" }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Registrar sesión</span>
            <span className="sm:hidden">Registrar</span>
          </motion.button>
        )}
      </div>

      {/* Player selector */}
      <motion.div {...stagger(0)}>
        <GlowCard className="p-4 rounded-2xl">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>Jugador:</label>
            <select
              value={selectedPlayer ?? ""}
              onChange={e => setSelectedPlayer(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 min-w-48 px-3 py-2 text-sm rounded-xl outline-none focus:ring-2 focus:ring-[rgba(0,255,135,0.3)]"
              style={inputStyle}
            >
              <option value="">Selecciona un jugador...</option>
              {(players as any[]).map((p: any) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
            {selectedPlayerData && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.2)", color: "var(--neon)" }}>
                {(sessions as any[]).length} sesiones
              </span>
            )}
          </div>
        </GlowCard>
      </motion.div>

      {/* Form */}
      <AnimatePresence>
        {showForm && selectedPlayer && (
          <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -10, height: 0 }}>
            <GlowCard className="p-5 rounded-2xl" style={{ border: "1px solid rgba(0,255,135,0.2)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold">Nueva sesión</p>
                <button onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Fecha</label>
                  <input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Tipo</label>
                  <select value={form.session_type} onChange={e => setForm(f => ({ ...f, session_type: e.target.value }))} className={inputCls} style={{ ...inputStyle, cursor: "pointer" }}>
                    {SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Duración (min)</label>
                  <input type="number" min={1} max={300} value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>RPE (1-10)</label>
                  <input type="number" min={1} max={10} value={form.rpe} onChange={e => setForm(f => ({ ...f, rpe: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              </div>
              {/* RPE visual scale */}
              <div className="flex gap-1 mt-3">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                  const active = Number(form.rpe) >= n;
                  const color = n <= 3 ? "#00ff87" : n <= 6 ? "#f59e0b" : n <= 8 ? "#f97316" : "#ff3b30";
                  return (
                    <button key={n} onClick={() => setForm(f => ({ ...f, rpe: String(n) }))}
                      className="flex-1 h-2 rounded-full transition-all"
                      style={{ background: active ? color : "rgba(255,255,255,0.08)" }}
                    />
                  );
                })}
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                RPE: <span className="font-bold text-white">{form.rpe}</span>
                {Number(form.rpe) <= 3 ? " — Muy ligero" : Number(form.rpe) <= 5 ? " — Moderado" : Number(form.rpe) <= 7 ? " — Duro" : " — Máximo esfuerzo"}
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => createSession.mutate({ player_id: selectedPlayer, ...form, duration_minutes: Number(form.duration_minutes), rpe: Number(form.rpe) })}
                  disabled={createSession.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "var(--neon)", color: "#000" }}
                >
                  {createSession.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Guardar
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm transition-colors" style={{ color: "var(--text-muted)" }}>
                  Cancelar
                </button>
              </div>
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data — only if player selected */}
      {selectedPlayer && (sessions as any[]).length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "ACWR actual",
                value: acwrValue ? acwrValue.toFixed(2) : "—",
                sub: zone.label,
                color: zone.color,
                icon: Activity,
                raw: true,
              },
              {
                label: "Carga aguda (7d)",
                value: lastSession?.acute_load ?? 0,
                sub: "UA — últimos 7 días",
                color: "#0ea5e9",
                icon: Zap,
              },
              {
                label: "Carga crónica (28d)",
                value: lastSession?.chronic_load ?? 0,
                sub: "UA — media 4 semanas",
                color: "#a855f7",
                icon: TrendingUp,
              },
            ].map(({ label, value, sub, color, icon: Icon, raw }, i) => (
              <motion.div key={label} {...stagger(i + 1)}>
                <GlowCard className="p-5 rounded-2xl text-center">
                  <div className="inline-flex p-2.5 rounded-xl mb-3" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  {raw ? (
                    <p className="text-4xl font-black" style={{ color }}>{value}</p>
                  ) : (
                    <AnimatedCounter value={Number(value)} className="text-4xl font-black" style={{ color } as any} />
                  )}
                  <p className="text-xs mt-1.5 font-semibold" style={{ color }}>{sub}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                </GlowCard>
              </motion.div>
            ))}
          </div>

          {/* ACWR zone legend */}
          <motion.div {...stagger(4)}>
            <GlowCard className="p-4 rounded-2xl">
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Zonas ACWR</p>
              <div className="flex gap-2 flex-wrap">
                {ACWR_ZONES.map(z => (
                  <div key={z.label} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                    style={{ background: `${z.color}12`, border: `1px solid ${z.color}30`, color: z.color, fontWeight: acwrValue && acwrValue >= z.min && acwrValue < z.max ? 800 : 500 }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                    {z.min}–{z.max >= 99 ? "∞" : z.max} · {z.label}
                  </div>
                ))}
              </div>
            </GlowCard>
          </motion.div>

          {/* Charts */}
          {chartData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Load chart */}
              <motion.div {...stagger(5)}>
                <GlowCard className="p-5 rounded-2xl">
                  <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                    Carga de sesión (últimas 30)
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff87" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#00ff87" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="load" stroke="#00ff87" fill="url(#loadGrad)" strokeWidth={2} name="Carga" />
                    </AreaChart>
                  </ResponsiveContainer>
                </GlowCard>
              </motion.div>

              {/* ACWR chart */}
              <motion.div {...stagger(6)}>
                <GlowCard className="p-5 rounded-2xl">
                  <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                    ACWR — Ratio carga aguda/crónica
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 2.2]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={0.8} stroke="#0ea5e9" strokeDasharray="4 2" strokeOpacity={0.5} />
                      <ReferenceLine y={1.3} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.5} />
                      <ReferenceLine y={1.5} stroke="#ff3b30" strokeDasharray="4 2" strokeOpacity={0.5} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="acwr" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 3, strokeWidth: 0 }} name="ACWR" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </GlowCard>
              </motion.div>
            </div>
          )}

          {/* Sessions table */}
          <motion.div {...stagger(7)}>
            <GlowCard className="rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ background: "rgba(255,166,0,0.1)" }}>
                    <Dumbbell className="w-4 h-4 text-orange-400" />
                  </div>
                  <h3 className="text-sm font-bold">Historial de sesiones</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                  {(sessions as any[]).length} sesiones
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {["Fecha", "Tipo", "Duración", "RPE", "Carga", "ACWR", "Zona"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(sessions as any[]).slice(0, 20).map((s: any, i: number) => {
                      const z = getZone(s.acwr);
                      const typeConfig = SESSION_TYPES.find(t => t.value === s.session_type);
                      return (
                        <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className="transition-colors" style={{ borderBottom: "1px solid var(--border-subtle)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{s.session_date}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${typeConfig?.color ?? "#64748b"}15`, color: typeConfig?.color ?? "#64748b" }}>
                              {typeConfig?.label ?? s.session_type}
                            </span>
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{s.duration_minutes ? `${s.duration_minutes} min` : "—"}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold" style={{ color: Number(s.rpe) <= 4 ? "#00ff87" : Number(s.rpe) <= 7 ? "#f59e0b" : "#ff3b30" }}>
                              {s.rpe ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-white/80">{s.session_load?.toFixed(0) ?? "—"}</td>
                          <td className="px-4 py-3 font-mono font-bold" style={{ color: s.acwr ? z.color : "var(--text-muted)" }}>{s.acwr ? s.acwr.toFixed(2) : "—"}</td>
                          <td className="px-4 py-3">
                            {s.acwr ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: z.color, background: `${z.color}15` }}>{z.label}</span>
                            ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          </motion.div>
        </>
      )}

      {/* Empty state */}
      {!selectedPlayer && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
          <div className="inline-flex p-5 rounded-2xl mb-4" style={{ background: "rgba(255,165,0,0.06)", border: "1px solid rgba(255,165,0,0.15)" }}>
            <Dumbbell className="w-8 h-8 text-orange-400 opacity-50" />
          </div>
          <p className="font-semibold text-white/50">Selecciona un jugador</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>para ver su carga de entrenamiento y ACWR</p>
        </motion.div>
      )}

      {selectedPlayer && (sessions as any[]).length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
          <div className="inline-flex p-4 rounded-2xl mb-4" style={{ background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.15)" }}>
            <Dumbbell className="w-7 h-7" style={{ color: "var(--neon)", opacity: 0.5 }} />
          </div>
          <p className="font-semibold text-white/50">Sin sesiones registradas</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Registra la primera sesión con el botón de arriba</p>
        </motion.div>
      )}
    </div>
  );
}
