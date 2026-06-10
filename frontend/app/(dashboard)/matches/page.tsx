"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { matchesApi } from "@/lib/api";
import { adaptMatches } from "@/lib/lupi-adapters";
import type { MatchResult } from "@/lib/lupi";
import { PageTitle, Card, ResultGlyph } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

const RES_WORD: Record<MatchResult, string> = { W: "victoria", D: "empate", L: "derrota" };

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

  const all = adaptMatches(matches);
  const byDateAsc = all.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const byDateDesc = all.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const played = byDateAsc.filter((m) => m.played);
  const seasonForm = played.slice(-12).map((m) => m.result).filter(Boolean) as MatchResult[];

  const tally = { W: 0, D: 0, L: 0 } as Record<MatchResult, number>;
  let gf = 0, ga = 0;
  for (const m of played) {
    if (m.result) tally[m.result] += 1;
    gf += m.gf ?? 0;
    ga += m.ga ?? 0;
  }

  return (
    <div className="screen">
      <PageTitle title="Partidos" subtitle="la temporada, partido a partido">
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          Nuevo partido
        </button>
      </PageTitle>

      {showForm && (
        <Card kicker="Registrar resultado" title="Nuevo partido">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Fecha</Note>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" />
            </div>
            <div>
              <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Rival</Note>
              <input type="text" placeholder="Nombre del rival" value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} className="input" />
            </div>
            <div>
              <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Competencia</Note>
              <input type="text" placeholder="Liga, Copa…" value={form.competition} onChange={e => setForm(f => ({ ...f, competition: e.target.value }))} className="input" />
            </div>
            <div>
              <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Goles a favor</Note>
              <input type="number" min={0} max={20} value={form.goals_for} onChange={e => setForm(f => ({ ...f, goals_for: e.target.value }))} className="input" />
            </div>
            <div>
              <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Goles en contra</Note>
              <input type="number" min={0} max={20} value={form.goals_against} onChange={e => setForm(f => ({ ...f, goals_against: e.target.value }))} className="input" />
            </div>
            <div>
              <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Condición</Note>
              <select value={form.is_home ? "home" : "away"} onChange={e => setForm(f => ({ ...f, is_home: e.target.value === "home" }))} className="input">
                <option value="home">Local</option>
                <option value="away">Visitante</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2" style={{ marginTop: 14 }}>
            <button onClick={() => createMatch.mutate(form)} disabled={!form.date || !form.opponent} className="btn-primary text-sm disabled:opacity-40">Guardar</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancelar</button>
          </div>
        </Card>
      )}

      <div className="grid-2-1">
        <Card kicker="Últimos 12 · izquierda = más antiguo" title="La racha">
          {seasonForm.length === 0 ? (
            <Note style={{ fontSize: 16, opacity: 0.7 }}>aún sin partidos jugados</Note>
          ) : (
            <>
              <div className="form-ribbon">
                {seasonForm.map((r, i) => (
                  <div className="form-mark" key={i} title={RES_WORD[r]}>
                    <ResultGlyph r={r} size={32} faded={i < seasonForm.length - 6} />
                  </div>
                ))}
              </div>
              <Note style={{ fontSize: 15, opacity: 0.75, display: "block", marginTop: 10 }}>
                las marcas tenues son de hace más de seis fechas
              </Note>
            </>
          )}
        </Card>

        <Card kicker="Balance del torneo" title="Cómo vamos">
          <div className="tally">
            <div className="tally-item"><span className="tally-num" style={{ color: "var(--pine)" }}>{tally.W}</span><Note style={{ fontSize: 15 }}>ganados</Note></div>
            <div className="tally-item"><span className="tally-num" style={{ color: "var(--ochre)" }}>{tally.D}</span><Note style={{ fontSize: 15 }}>empatados</Note></div>
            <div className="tally-item"><span className="tally-num" style={{ color: "var(--terracotta)" }}>{tally.L}</span><Note style={{ fontSize: 15 }}>perdidos</Note></div>
          </div>
          <div className="goals-row">
            <div><b>{gf}</b> goles a favor</div>
            <div><b>{ga}</b> en contra</div>
            <div className="goals-diff">{gf - ga >= 0 ? "+" : ""}{gf - ga}</div>
          </div>
        </Card>
      </div>

      <Card kicker="Resultados recientes y lo que viene" title="El calendario de partidos">
        {isLoading ? (
          <Note style={{ fontSize: 17, opacity: 0.7, display: "block", padding: "16px 4px" }}>leyendo el fixture…</Note>
        ) : byDateDesc.length === 0 ? (
          <div className="coming" style={{ padding: "32px 0" }}>
            <svg width="96" height="96" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="34" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="3 5" filter="url(#wobble)" />
              <circle cx="60" cy="60" r="10" fill="var(--ochre)" filter="url(#wobble)" />
            </svg>
            <Note style={{ fontSize: 18, marginTop: 8 }}>Sin partidos registrados todavía.</Note>
          </div>
        ) : (
          <div className="match-list">
            {byDateDesc.map((m) => (
              <Link href={`/matches/${m.id}`} className={"match-full" + (!m.played ? " is-next" : "")} key={m.id}>
                <ResultGlyph r={m.result} size={42} />
                <div className="match-full-body">
                  <div className="match-full-opp">{m.home ? "vs" : "@"} {m.opp}
                    {m.comp && <span className="comp-tag">{m.comp}</span>}
                  </div>
                  <div className="match-full-meta">
                    {m.played
                      ? (m.result ? RES_WORD[m.result] : <span style={{ opacity: 0.6 }}>sin definición</span>)
                      : <Note style={{ fontSize: 16 }}>aún por jugarse</Note>}
                  </div>
                </div>
                <div className="match-full-score">
                  {m.played ? <b>{m.gf}–{m.ga}</b> : <span className="score-tbd">—</span>}
                </div>
                <div className="match-full-date">{m.date}</div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
