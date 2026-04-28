"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { matchesApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";
import { Plus, Trophy, Home, Plane, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function MatchesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", opponent: "", is_home: true, competition: "", goals_for: "", goals_against: "" });

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: () => matchesApi.list(),
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
    <div className="space-y-5">
      <PageHeader
        title="Partidos"
        subtitle={`${matches?.length ?? 0} partidos registrados`}
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo partido</span>
          </button>
        }
      />

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="space-y-4">
            <h3 className="text-sm font-semibold text-white/80">Registrar partido</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/30 mb-1 block">Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Rival</label>
                <input type="text" placeholder="Nombre del rival" value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Competencia</label>
                <input type="text" placeholder="Liga, Copa..." value={form.competition} onChange={e => setForm(f => ({ ...f, competition: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Goles a favor</label>
                <input type="number" min={0} max={20} value={form.goals_for} onChange={e => setForm(f => ({ ...f, goals_for: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Goles en contra</label>
                <input type="number" min={0} max={20} value={form.goals_against} onChange={e => setForm(f => ({ ...f, goals_against: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Condición</label>
                <select value={form.is_home ? "home" : "away"} onChange={e => setForm(f => ({ ...f, is_home: e.target.value === "home" }))} className="input w-full">
                  <option value="home">Local</option>
                  <option value="away">Visitante</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMatch.mutate(form)} disabled={!form.date || !form.opponent} className="btn-primary text-sm disabled:opacity-40">
                Guardar
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">
                Cancelar
              </button>
            </div>
          </Card>
        </motion.div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Fecha", "Rival", "Cond.", "Resultado", "Competencia", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-white/30">Cargando partidos...</td>
                </tr>
              ) : !matches?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <div className="inline-flex p-4 rounded-xl mb-3 bg-white/[0.03] border border-white/[0.06]">
                      <Trophy className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-sm font-semibold text-white/40">Sin partidos registrados</p>
                  </td>
                </tr>
              ) : (
                matches.map((m: any, i: number) => {
                  const won = m.goals_for != null && m.goals_against != null && m.goals_for > m.goals_against;
                  const lost = m.goals_for != null && m.goals_against != null && m.goals_for < m.goals_against;
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 tabular-nums text-white/30">{m.date}</td>
                      <td className="px-4 py-3 font-semibold text-white/90">{m.opponent}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          m.is_home ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        }`}>
                          {m.is_home ? <Home className="w-3 h-3" /> : <Plane className="w-3 h-3" />}
                          <span className="hidden sm:inline">{m.is_home ? "Local" : "Visitante"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {m.goals_for != null && m.goals_against != null ? (
                          <span className={`font-bold ${won ? "text-emerald-400" : lost ? "text-red-400" : "text-amber-400"}`}>
                            {m.goals_for} — {m.goals_against}
                            <span className="text-xs font-normal ml-1 opacity-60">{won ? "G" : lost ? "P" : "E"}</span>
                          </span>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/30">{m.competition ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/matches/${m.id}`}>
                          <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                            Stats <ChevronRight className="w-3 h-3" />
                          </button>
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
