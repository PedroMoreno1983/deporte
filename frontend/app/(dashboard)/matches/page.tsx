"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { matchesApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";
import { Plus, Trophy, Home, Plane, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { toast } from "sonner";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface-3)", border: "1px solid var(--border-medium)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-bold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function MatchesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", opponent: "", is_home: true, competition: "", goals_for: "", goals_against: "" });

  const { data: matches, isLoading } = useQuery({ queryKey: ["matches"], queryFn: () => matchesApi.list() });

  const createMatch = useMutation({
    mutationFn: (data: typeof form) =>
      matchesApi.create({ ...data, goals_for: data.goals_for ? Number(data.goals_for) : null, goals_against: data.goals_against ? Number(data.goals_against) : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      setShowForm(false);
      setForm({ date: "", opponent: "", is_home: true, competition: "", goals_for: "", goals_against: "" });
      toast.success("Partido registrado");
    },
  });

  const wins   = (matches as any[] ?? []).filter((m: any) => m.goals_for != null && m.goals_for > m.goals_against).length;
  const losses = (matches as any[] ?? []).filter((m: any) => m.goals_for != null && m.goals_for < m.goals_against).length;
  const draws  = (matches as any[] ?? []).filter((m: any) => m.goals_for != null && m.goals_for === m.goals_against).length;

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

      {/* Season summary */}
      {(matches as any[] ?? []).length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Victorias", value: wins,   color: "var(--success)" },
            { label: "Empates",   value: draws,  color: "var(--warning)" },
            { label: "Derrotas",  value: losses, color: "var(--danger)"  },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-4 text-center">
              <p className="text-3xl font-black tabular-nums" style={{ color }}>{value}</p>
              <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card variant="brand" className="space-y-4">
            <h3 className="text-sm font-bold text-white/90">Registrar partido</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Rival</label>
                <input type="text" placeholder="Nombre del rival" value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Competencia</label>
                <input type="text" placeholder="Liga, Copa..." value={form.competition} onChange={e => setForm(f => ({ ...f, competition: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Goles a favor</label>
                <input type="number" min={0} max={20} value={form.goals_for} onChange={e => setForm(f => ({ ...f, goals_for: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Goles en contra</label>
                <input type="number" min={0} max={20} value={form.goals_against} onChange={e => setForm(f => ({ ...f, goals_against: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Condición</label>
                <select value={form.is_home ? "home" : "away"} onChange={e => setForm(f => ({ ...f, is_home: e.target.value === "home" }))} className="input">
                  <option value="home">Local</option>
                  <option value="away">Visitante</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMatch.mutate(form)} disabled={!form.date || !form.opponent} className="btn-primary text-sm disabled:opacity-40">Guardar</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancelar</button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Table */}
      <Card className="overflow-hidden" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.015)" }}>
                {["Fecha", "Rival", "Cond.", "Resultado", "Competencia", ""].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div
                          className="skeleton h-4 rounded"
                          style={{ width: j === 0 ? 64 : j === 1 ? 120 : j === 2 ? 100 : 60, animationDelay: `${(i * 6 + j) * 0.03}s` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !matches?.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      illustration="matches"
                      title="Sin partidos registrados"
                      description="Cuando registres un partido aparecerá acá con su resultado y stats."
                    />
                  </td>
                </tr>
              ) : (
                (matches as any[]).map((m: any, i: number) => {
                  const won  = m.goals_for != null && m.goals_against != null && m.goals_for > m.goals_against;
                  const lost = m.goals_for != null && m.goals_against != null && m.goals_for < m.goals_against;
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.025 }}
                      className="transition-colors"
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-5 py-3.5 tabular-nums text-sm font-mono" style={{ color: "var(--text-muted)" }}>{m.date}</td>
                      <td className="px-5 py-3.5 font-semibold text-white/90">{m.opponent}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                          style={m.is_home
                            ? { color: "#0ea5e9", background: "rgba(14,165,233,0.08)", borderColor: "rgba(14,165,233,0.2)" }
                            : { color: "#A855F7", background: "rgba(168,85,247,0.08)", borderColor: "rgba(168,85,247,0.2)" }}
                        >
                          {m.is_home ? <Home className="w-3 h-3" /> : <Plane className="w-3 h-3" />}
                          <span className="hidden sm:inline">{m.is_home ? "Local" : "Visitante"}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {m.goals_for != null && m.goals_against != null ? (
                          <span className="font-bold tabular-nums" style={{ color: won ? "var(--success)" : lost ? "var(--danger)" : "var(--warning)" }}>
                            {m.goals_for} — {m.goals_against}
                            <span className="text-[10px] font-normal ml-1 opacity-60">{won ? "G" : lost ? "P" : "E"}</span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Pendiente</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "var(--text-muted)" }}>{m.competition ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <Link href={`/matches/${m.id}`}>
                          <button
                            className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-colors font-semibold"
                            style={{ color: "var(--brand)", background: "rgba(0,255,135,0.06)", borderColor: "rgba(0,255,135,0.18)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,255,135,0.12)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,255,135,0.06)")}
                          >
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
