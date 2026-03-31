"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { trainingApi, playersApi } from "@/lib/api";
import { useState } from "react";
import { Dumbbell, Plus, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

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

  const { data: players } = useQuery({
    queryKey: ["players"],
    queryFn: () => playersApi.list(),
  });

  const { data: sessions } = useQuery({
    queryKey: ["training", selectedPlayer],
    queryFn: () => selectedPlayer ? trainingApi.getByPlayer(selectedPlayer) : Promise.resolve([]),
    enabled: !!selectedPlayer,
  });

  const createSession = useMutation({
    mutationFn: (data: unknown) => trainingApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training", selectedPlayer] });
      setShowForm(false);
      toast.success("Sesión registrada");
    },
  });

  // Prepare ACWR chart data (last 30 sessions, reversed for chronological order)
  const chartData = sessions
    ? [...sessions].reverse().slice(-30).map((s: {
        session_date: string; session_load?: number; acwr?: number; acute_load?: number; chronic_load?: number
      }) => ({
        date: s.session_date,
        load: s.session_load ?? 0,
        acwr: s.acwr ?? null,
        acute: s.acute_load ?? 0,
        chronic: s.chronic_load ?? 0,
      }))
    : [];

  const lastSession = sessions?.[0];
  const acwrValue = lastSession?.acwr;
  const acwrColor = !acwrValue ? "text-muted-foreground" :
    acwrValue < 0.8 ? "text-blue-400" :
    acwrValue <= 1.3 ? "text-emerald-400" :
    acwrValue <= 1.5 ? "text-yellow-400" : "text-red-400";
  const acwrLabel = !acwrValue ? "Sin datos" :
    acwrValue < 0.8 ? "Sub-carga" :
    acwrValue <= 1.3 ? "Zona óptima" :
    acwrValue <= 1.5 ? "Precaución" : "Zona de riesgo";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <Dumbbell className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Entrenamiento</h1>
          <p className="text-muted-foreground text-sm">Carga de trabajo y ACWR por jugador</p>
        </div>
      </div>

      {/* Player selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedPlayer ?? ""}
          onChange={e => setSelectedPlayer(e.target.value ? Number(e.target.value) : null)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-w-48"
        >
          <option value="">Selecciona un jugador</option>
          {players?.map((p: { id: number; first_name: string; last_name: string }) => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>

        {selectedPlayer && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Registrar sesión
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && selectedPlayer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5 border border-emerald-500/20"
        >
          <h3 className="text-sm font-semibold mb-4">Nueva sesión</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fecha</label>
              <input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
              <select value={form.session_type} onChange={e => setForm(f => ({ ...f, session_type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="training">Entrenamiento</option>
                <option value="match">Partido</option>
                <option value="gym">Gimnasio</option>
                <option value="recovery">Recuperación</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Duración (min)</label>
              <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">RPE (1-10)</label>
              <input type="number" min={1} max={10} value={form.rpe} onChange={e => setForm(f => ({ ...f, rpe: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => createSession.mutate({ player_id: selectedPlayer, ...form, duration_minutes: Number(form.duration_minutes), rpe: Number(form.rpe) })}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {selectedPlayer && sessions && (
        <>
          {/* ACWR indicator */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass rounded-xl p-4 text-center">
              <div className={`text-3xl font-bold ${acwrColor}`}>
                {acwrValue ? acwrValue.toFixed(2) : "-"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">ACWR actual</div>
              <div className={`text-xs mt-1 font-medium ${acwrColor}`}>{acwrLabel}</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">
                {lastSession?.acute_load?.toFixed(0) ?? "-"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Carga aguda (7d)</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">
                {lastSession?.chronic_load?.toFixed(0) ?? "-"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Carga crónica (28d)</div>
            </div>
          </div>

          {/* ACWR Chart */}
          {chartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5"
            >
              <h3 className="text-sm font-semibold mb-4">Evolución de carga (últimas 30 sesiones)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="rgba(255,255,255,0.2)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                  <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="load" stroke="#10b981" fill="url(#loadGrad)" strokeWidth={2} name="Carga sesión" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Sessions table */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Historial de sesiones</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-white/2">
                    {["Fecha", "Tipo", "Duración", "RPE", "Carga", "ACWR", "Zona"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 20).map((s: {
                    id: number; session_date: string; session_type: string; duration_minutes?: number;
                    rpe?: number; session_load?: number; acwr?: number
                  }) => {
                    const acwr = s.acwr;
                    const zone = !acwr ? "-" : acwr < 0.8 ? "Sub-carga" : acwr <= 1.3 ? "Óptima" : acwr <= 1.5 ? "Precaución" : "Riesgo";
                    const zoneColor = !acwr ? "text-muted-foreground" : acwr <= 1.3 ? "text-emerald-400" : acwr <= 1.5 ? "text-yellow-400" : "text-red-400";
                    return (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{s.session_date}</td>
                        <td className="px-4 py-3 capitalize">{s.session_type}</td>
                        <td className="px-4 py-3">{s.duration_minutes ? `${s.duration_minutes} min` : "-"}</td>
                        <td className="px-4 py-3">{s.rpe ?? "-"}</td>
                        <td className="px-4 py-3 font-mono">{s.session_load?.toFixed(0) ?? "-"}</td>
                        <td className="px-4 py-3 font-mono">{acwr ? acwr.toFixed(2) : "-"}</td>
                        <td className={`px-4 py-3 text-xs font-medium ${zoneColor}`}>{zone}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedPlayer && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Dumbbell className="w-12 h-12 text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground text-sm">Selecciona un jugador para ver su carga de entrenamiento</p>
        </div>
      )}
    </div>
  );
}
