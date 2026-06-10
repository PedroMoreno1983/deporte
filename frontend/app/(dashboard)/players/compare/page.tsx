"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { playersApi, predictionsApi } from "@/lib/api";
import { adaptRoster } from "@/lib/lupi-adapters";
import { type LupiPlayer, POS_LABEL } from "@/lib/lupi";
import { PageTitle, Card } from "@/components/lupi/viz";
import { PlayerGlyph, Note } from "@/components/lupi/primitives";

const METRICS: { key: keyof LupiPlayer; label: string; lo: number; hi: number; fmt: (v: number) => string }[] = [
  { key: "minutes", label: "Minutos", lo: 0, hi: 2700, fmt: (v) => v.toLocaleString("es") + "′" },
  { key: "age", label: "Edad", lo: 18, hi: 36, fmt: (v) => v + " años" },
  { key: "risk", label: "Riesgo de lesión", lo: 0, hi: 100, fmt: (v) => v + "/100" },
];

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export default function PlayerComparePage() {
  const { data: players } = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: teamRisk } = useQuery({ queryKey: ["team-risk"], queryFn: () => predictionsApi.teamRisk() });

  const roster = adaptRoster(players, teamRisk);
  const [aId, setA] = useState<number | null>(null);
  const [bId, setB] = useState<number | null>(null);

  if (roster.length < 2) {
    return (
      <div className="screen">
        <PageTitle title="Comparar" subtitle="dos jugadores, lado a lado" />
        <Card>
          <Note style={{ fontSize: 17, opacity: 0.7, display: "block", padding: "24px 4px" }}>
            se necesitan al menos dos jugadores para comparar.
          </Note>
        </Card>
      </div>
    );
  }

  const A = roster.find((p) => p.id === aId) ?? roster[0];
  const B = roster.find((p) => p.id === bId) ?? roster[1];

  return (
    <div className="screen">
      <PageTitle title="Comparar" subtitle="dos jugadores, lado a lado" />
      <Card kicker="Elige dos nombres" title="Cara a cara">
        <div className="compare-heads">
          <div className="cmp-head">
            <PlayerGlyph p={A} box={72} />
            <select className="cmp-select" value={String(A.id)} onChange={(e) => setA(+e.target.value)}>
              {roster.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
            <Note style={{ fontSize: 15 }}>{POS_LABEL[A.pos]}</Note>
          </div>
          <div className="cmp-vs">vs</div>
          <div className="cmp-head">
            <PlayerGlyph p={B} box={72} />
            <select className="cmp-select" value={String(B.id)} onChange={(e) => setB(+e.target.value)}>
              {roster.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
            <Note style={{ fontSize: 15 }}>{POS_LABEL[B.pos]}</Note>
          </div>
        </div>

        <div className="cmp-metrics">
          {METRICS.map((m) => {
            const va = A[m.key] as number;
            const vb = B[m.key] as number;
            const ta = clamp01((va - m.lo) / (m.hi - m.lo));
            const tb = clamp01((vb - m.lo) / (m.hi - m.lo));
            return (
              <div className="cmp-metric" key={String(m.key)}>
                <div className="cmp-metric-head">
                  <span className="cmp-a">{m.fmt(va)}</span>
                  <span className="cmp-metric-label">{m.label}</span>
                  <span className="cmp-b">{m.fmt(vb)}</span>
                </div>
                <div className="cmp-track">
                  <span className="cmp-tick a" style={{ left: `${ta * 100}%` }} />
                  <span className="cmp-tick b" style={{ left: `${tb * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="cmp-key">
          <span className="cmp-dot a" /> {A.name.split(" ")[0]}
          <span className="cmp-dot b" style={{ marginLeft: 18 }} /> {B.name.split(" ")[0]}
        </div>
      </Card>
    </div>
  );
}
