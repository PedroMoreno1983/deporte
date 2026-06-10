"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { playersApi, predictionsApi } from "@/lib/api";
import { adaptRoster } from "@/lib/lupi-adapters";
import { POS_COLOR, RISK_COLOR } from "@/lib/lupi";
import { PRED_FACTORS } from "@/lib/lupi-fallbacks";
import { PageTitle, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

const maxWeight = Math.max(...PRED_FACTORS.map((f) => f.weight));

export default function PredictionsPage() {
  const { data: players } = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: teamRisk } = useQuery({ queryKey: ["team-risk"], queryFn: () => predictionsApi.teamRisk() });

  const roster = adaptRoster(players, teamRisk);
  const sorted = roster.slice().sort((a, b) => b.risk - a.risk);

  return (
    <div className="screen">
      <PageTitle title="Predicciones" subtitle="el modelo de riesgo, explicado" />

      <Card kicker="Cada punto es un jugador · eje = riesgo de 0 a 100" title="Distribución del riesgo"
        note="la cola derecha es la que nos preocupa">
        {roster.length === 0 ? (
          <Note style={{ fontSize: 16, opacity: 0.7 }}>sin datos de riesgo todavía</Note>
        ) : (
          <div className="risk-axis">
            {roster.map((p, i) => (
              <div key={p.id} className="risk-dot-wrap" style={{ left: `${p.risk}%`, top: `${8 + (i % 5) * 15}px` }}
                title={`${p.name} · ${p.risk}`}>
                <span className="risk-dot" style={{ background: RISK_COLOR[p.riskLevel] }} />
              </div>
            ))}
            <div className="risk-axis-line" />
            <div className="risk-bands">
              <span style={{ left: "0%", width: "30%" }}>bajo</span>
              <span style={{ left: "30%", width: "20%" }}>medio</span>
              <span style={{ left: "50%", width: "20%" }}>alto</span>
              <span style={{ left: "70%", width: "30%" }}>crítico</span>
            </div>
          </div>
        )}
      </Card>

      <div className="grid-2-1">
        <Card kicker="Modelo predictivo · prioridad" title="Tabla completa de riesgo">
          {sorted.length === 0 ? (
            <Note style={{ fontSize: 16, opacity: 0.7 }}>sin jugadores en el modelo</Note>
          ) : (
            <div className="pred-list">
              {sorted.map((p, i) => {
                const TICKS = 14, filled = Math.round((p.risk / 100) * TICKS);
                return (
                  <Link href={`/players/${p.id}`} className="pred-row" key={p.id}>
                    <span className="ledger-rank">{i + 1}</span>
                    <span className="ledger-pos" style={{ background: POS_COLOR[p.pos] }} />
                    <span className="pred-name">{p.name}</span>
                    <span className="ledger-ticks">
                      {Array.from({ length: TICKS }).map((_, k) => (
                        <span key={k} className="tick"
                          style={{ background: k < filled ? RISK_COLOR[p.riskLevel] : "transparent", borderColor: k < filled ? RISK_COLOR[p.riskLevel] : "var(--rule)" }} />
                      ))}
                    </span>
                    <span className="pred-score">{p.risk}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card kicker="Qué pesa en el modelo" title="Factores de riesgo">
          <div className="factors">
            {PRED_FACTORS.map((f) => (
              <div className="factor" key={f.label}>
                <div className="factor-head">
                  <span className="factor-label">{f.label}</span>
                  <span className="factor-weight">{Math.round(f.weight * 100)}%</span>
                </div>
                <div className="factor-track">
                  <span className="factor-fill" style={{ width: `${(f.weight / maxWeight) * 92}%` }} />
                </div>
                <Note style={{ fontSize: 14.5, opacity: 0.78 }}>{f.note}</Note>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
