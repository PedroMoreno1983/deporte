"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trainingApi, playersApi } from "@/lib/api";
import { TRAIN_TYPE, TRAINING_WEEKS, WEEK_PLAN } from "@/lib/lupi-fallbacks";
import { PageTitle, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

const SESSION_LABEL: Record<string, string> = {
  training: "entrenamiento", match: "partido", gym: "gimnasio", recovery: "recuperación",
};

const ACWR_ZONES = [
  { min: 0,   max: 0.8, label: "sub-carga",  color: "var(--slate)" },
  { min: 0.8, max: 1.3, label: "óptima",     color: "var(--pine)" },
  { min: 1.3, max: 1.5, label: "precaución", color: "var(--ochre)" },
  { min: 1.5, max: 99,  label: "riesgo",     color: "var(--terracotta)" },
];
function getZone(acwr?: number | null) {
  if (!acwr) return ACWR_ZONES[0];
  return ACWR_ZONES.find((z) => acwr >= z.min && acwr < z.max) ?? ACWR_ZONES[3];
}

export default function TrainingPage() {
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: sessions = [] } = useQuery({
    queryKey: ["training", selectedPlayer],
    queryFn: () => (selectedPlayer ? trainingApi.getByPlayer(selectedPlayer) : Promise.resolve([])),
    enabled: !!selectedPlayer,
  });

  const sess = sessions as any[];
  const last = sess[0];
  const zone = getZone(last?.acwr);
  const maxLoad = Math.max(...TRAINING_WEEKS.map((w) => w.sessions.reduce((a, s) => a + s[1], 0)));
  const colH = 200;

  return (
    <div className="screen">
      <PageTitle title="Entrenamiento" subtitle="la carga del cuerpo, hecha visible" />

      <Card kicker="Cada bloque es una sesión · altura = carga" title="La carga, semana a semana"
        note="el plantel en conjunto, semana a semana">
        <div className="train-chart">
          {TRAINING_WEEKS.map((w) => {
            const total = w.sessions.reduce((a, s) => a + s[1], 0);
            return (
              <div className="train-col" key={w.week}>
                <div className="train-stack" style={{ height: colH }}>
                  {w.sessions.map((s, i) => (
                    <div key={i} className="train-block" title={`${TRAIN_TYPE[s[0]].label}: ${s[1]}`}
                      style={{ height: (s[1] / maxLoad) * colH, background: TRAIN_TYPE[s[0]].color, opacity: 0.85 }} />
                  ))}
                </div>
                <div className="train-axis" />
                <div className="train-week">{w.week}</div>
                <div className="train-total">{total}</div>
              </div>
            );
          })}
        </div>
        <div className="tl-legend">
          {Object.entries(TRAIN_TYPE).map(([k, v]) => (
            <div className="tl-leg-item" key={k}><span className="tl-dot" style={{ background: v.color }} />{v.label}</div>
          ))}
        </div>
      </Card>

      <Card kicker="Microciclo en curso" title="El plan de esta semana">
        <div className="week-plan">
          {WEEK_PLAN.map((d) => (
            <div className={"plan-day" + (d.match ? " is-match" : "")} key={d.day}>
              <div className="plan-dayname">{d.day}</div>
              <div className="plan-glyph">
                <svg width="40" height="40">
                  <circle cx="20" cy="20" r={6 + d.intensity * 2.4} fill={TRAIN_TYPE[d.type].color}
                    opacity={0.3 + d.intensity * 0.13} filter="url(#wobble)" />
                </svg>
              </div>
              <div className="plan-type" style={{ color: TRAIN_TYPE[d.type].color }}>{TRAIN_TYPE[d.type].label}</div>
              <div className="plan-label">{d.label}</div>
              <div className="plan-intensity">{"●".repeat(d.intensity)}<span className="dim">{"●".repeat(5 - d.intensity)}</span></div>
            </div>
          ))}
        </div>
        <Note style={{ fontSize: 15, opacity: 0.75, display: "block", marginTop: 12 }}>
          círculo más grande = sesión más intensa · los puntos marcan la intensidad de 1 a 5
        </Note>
      </Card>

      <Card kicker="Datos reales · carga aguda/crónica por jugador" title="ACWR jugador por jugador">
        <div className="filter-bar" style={{ marginBottom: 14 }}>
          <select
            value={selectedPlayer ?? ""}
            onChange={(e) => setSelectedPlayer(e.target.value ? Number(e.target.value) : null)}
            className="lupi-select"
          >
            <option value="">Selecciona un jugador…</option>
            {(players as any[]).map((p: any) => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
            ))}
          </select>
          {selectedPlayer && <Note style={{ fontSize: 15, marginLeft: "auto", opacity: 0.75 }}>{sess.length} sesiones</Note>}
        </div>

        {!selectedPlayer ? (
          <Note style={{ fontSize: 17, opacity: 0.7, display: "block", padding: "8px 4px" }}>
            elige un jugador para leer su carga y su ACWR.
          </Note>
        ) : sess.length === 0 ? (
          <Note style={{ fontSize: 17, opacity: 0.7, display: "block", padding: "8px 4px" }}>
            este jugador aún no tiene sesiones registradas.
          </Note>
        ) : (
          <>
            <div className="marginalia">
              <div className="margin-item">
                <span className="margin-num" style={{ color: zone.color }}>{last?.acwr ? last.acwr.toFixed(2) : "—"}</span>
                <Note style={{ fontSize: 15 }}>ACWR · {zone.label}</Note>
              </div>
              <div className="margin-item">
                <span className="margin-num" style={{ color: "var(--slate)" }}>{last?.acute_load ?? 0}</span>
                <Note style={{ fontSize: 15 }}>carga aguda (7d)</Note>
              </div>
              <div className="margin-item">
                <span className="margin-num" style={{ color: "var(--plum)" }}>{last?.chronic_load ?? 0}</span>
                <Note style={{ fontSize: 15 }}>carga crónica (28d)</Note>
              </div>
            </div>

            <div className="inj-list" style={{ marginTop: 8 }}>
              {sess.slice(0, 14).map((s: any, i: number) => {
                const z = getZone(s.acwr);
                return (
                  <div className="inj-row" key={s.id ?? i}>
                    <span className="inj-region-dot" style={{ background: z.color }} />
                    <span className="inj-player">{SESSION_LABEL[s.session_type] ?? s.session_type}</span>
                    <span className="inj-region">{s.duration_minutes ? `${s.duration_minutes}′` : "—"}</span>
                    <span className="inj-month">RPE {s.rpe ?? "—"}</span>
                    <span className="inj-sev" style={{ color: z.color }}>{s.acwr ? s.acwr.toFixed(2) : "—"}</span>
                    <span className="inj-days"><b>{s.session_load?.toFixed(0) ?? "—"}</b> carga</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
