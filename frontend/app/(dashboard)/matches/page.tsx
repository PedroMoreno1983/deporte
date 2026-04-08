"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { matchesApi, categoriesApi } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";
import { Plus, Trophy, Home, Plane, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const inputCls =
  "w-full px-3 py-2 text-sm rounded-xl outline-none transition-all duration-200"
  + " focus:ring-2 focus:ring-emerald-500/30";
const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
};

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

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] as any },
  });

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <PageHeader
        icon={Trophy}
        title="Partidos"
        description={`${matches?.length ?? 0} partidos registrados`}
        iconColor="text-yellow-400"
        iconBg="bg-yellow-500/10 border-yellow-500/20"
        className="pl-10 sm:pl-12 lg:pl-0"
        action={
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "var(--neon)",
              color: "#000",
              boxShadow: "0 0 20px rgba(0,255,135,0.35)",
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo partido</span>
            <span className="sm:hidden">Nuevo</span>
          </motion.button>
        }
      />

      {/* Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlowCard className="p-5 rounded-2xl">
            <h3 className="text-sm font-semibold mb-4 text-white/80">Registrar partido</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Fecha</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Rival</label>
                <input
                  type="text"
                  placeholder="Nombre del rival"
                  value={form.opponent}
                  onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Competencia</label>
                <input
                  type="text"
                  placeholder="Liga, Copa, Amistoso..."
                  value={form.competition}
                  onChange={e => setForm(f => ({ ...f, competition: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Goles a favor</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={form.goals_for}
                  onChange={e => setForm(f => ({ ...f, goals_for: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Goles en contra</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={form.goals_against}
                  onChange={e => setForm(f => ({ ...f, goals_against: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Condición</label>
                <select
                  value={form.is_home ? "home" : "away"}
                  onChange={e => setForm(f => ({ ...f, is_home: e.target.value === "home" }))}
                  className={inputCls}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="home">Local</option>
                  <option value="away">Visitante</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => createMatch.mutate(form)}
                disabled={!form.date || !form.opponent}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{
                  background: "var(--neon)",
                  color: "#000",
                }}
              >
                Guardar
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Cancelar
              </button>
            </div>
          </GlowCard>
        </motion.div>
      )}

      {/* Table */}
      <motion.div {...stagger(0)}>
        <GlowCard className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Fecha", "Rival", "Cond.", "Resultado", "Competencia", ""].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                      Cargando partidos...
                    </td>
                  </tr>
                ) : !matches?.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <div
                        className="inline-flex p-4 rounded-2xl mb-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}
                      >
                        <Trophy className="w-6 h-6" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                        Sin partidos registrados
                      </p>
                    </td>
                  </tr>
                ) : (
                  matches.map((m: {
                    id: number; date: string; opponent: string; is_home: boolean;
                    goals_for?: number; goals_against?: number; competition?: string;
                  }, i: number) => {
                    const won = m.goals_for != null && m.goals_against != null && m.goals_for > m.goals_against;
                    const lost = m.goals_for != null && m.goals_against != null && m.goals_for < m.goals_against;
                    return (
                      <motion.tr
                        key={m.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{m.date}</td>
                        <td className="px-4 py-3 font-semibold text-white/90">{m.opponent}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                              m.is_home
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-purple-500/10 text-purple-400"
                            }`}
                          >
                            {m.is_home ? <Home className="w-3 h-3" /> : <Plane className="w-3 h-3" />}
                            <span className="hidden sm:inline">{m.is_home ? "Local" : "Visitante"}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {m.goals_for != null && m.goals_against != null ? (
                            <span
                              className="font-bold"
                              style={{
                                color: won ? "var(--neon)" : lost ? "var(--danger)" : "#f59e0b",
                              }}
                            >
                              {m.goals_for} — {m.goals_against}
                              <span className="text-xs font-normal ml-1 opacity-60">
                                {won ? "G" : lost ? "P" : "E"}
                              </span>
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                          {m.competition ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/matches/${m.id}`}>
                            <button
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
                              style={{ color: "var(--neon)", background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.15)" }}
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
        </GlowCard>
      </motion.div>
    </div>
  );
}
