"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { matchesApi, categoriesApi } from "@/lib/api";
import { useState } from "react";
import { Plus, Trophy, Home, Plane, Star } from "lucide-react";
import { toast } from "sonner";

export default function MatchesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: "", opponent: "", is_home: true,
    competition: "", goals_for: "", goals_against: "",
  });

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: () => matchesApi.list(),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const createMatch = useMutation({
    mutationFn: (data: typeof form) =>
      matchesApi.create({
        ...data,
        goals_for: data.goals_for ? Number(data.goals_for) : null,
        goals_against: data.goals_against ? Number(data.goals_against) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      setShowForm(false);
      setForm({ date: "", opponent: "", is_home: true, competition: "", goals_for: "", goals_against: "" });
      toast.success("Partido registrado");
    },
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Partidos</h1>
            <p className="text-muted-foreground text-sm">{matches?.length ?? 0} partidos registrados</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo partido
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5 border border-emerald-500/20"
        >
          <h3 className="text-sm font-semibold mb-4">Registrar partido</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fecha</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Rival</label>
              <input type="text" placeholder="Nombre del rival" value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Competencia</label>
              <input type="text" placeholder="Liga, Copa, Amistoso..." value={form.competition} onChange={e => setForm(f => ({ ...f, competition: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Goles a favor</label>
              <input type="number" min={0} max={20} value={form.goals_for} onChange={e => setForm(f => ({ ...f, goals_for: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Goles en contra</label>
              <input type="number" min={0} max={20} value={form.goals_against} onChange={e => setForm(f => ({ ...f, goals_against: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Condición</label>
              <select value={form.is_home ? "home" : "away"} onChange={e => setForm(f => ({ ...f, is_home: e.target.value === "home" }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="home">Local</option>
                <option value="away">Visitante</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMatch.mutate(form)} disabled={!form.date || !form.opponent}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/2">
                {["Fecha", "Rival", "Cond.", "Resultado", "Competencia"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Cargando...</td></tr>
              ) : matches?.map((m: {
                id: number; date: string; opponent: string; is_home: boolean;
                goals_for?: number; goals_against?: number; competition?: string
              }, i: number) => {
                const won = m.goals_for != null && m.goals_against != null && m.goals_for > m.goals_against;
                const lost = m.goals_for != null && m.goals_against != null && m.goals_for < m.goals_against;
                const draw = m.goals_for != null && m.goals_against != null && m.goals_for === m.goals_against;
                return (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-border/50 hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{m.date}</td>
                    <td className="px-4 py-3 font-medium">{m.opponent}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${m.is_home ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>
                        {m.is_home ? <Home className="w-3 h-3" /> : <Plane className="w-3 h-3" />}
                        {m.is_home ? "Local" : "Visitante"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.goals_for != null && m.goals_against != null ? (
                        <span className={`font-bold ${won ? "text-emerald-400" : lost ? "text-red-400" : "text-yellow-400"}`}>
                          {m.goals_for} - {m.goals_against}
                          <span className="text-xs font-normal ml-1 opacity-70">{won ? "G" : lost ? "P" : "E"}</span>
                        </span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.competition ?? "-"}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
