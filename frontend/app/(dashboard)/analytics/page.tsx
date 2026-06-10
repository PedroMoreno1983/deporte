"use client";
import { useQuery } from "@tanstack/react-query";
import { playersApi, predictionsApi } from "@/lib/api";
import { adaptRoster } from "@/lib/lupi-adapters";
import { type LupiPos, POS_COLOR, POS_LABEL } from "@/lib/lupi";
import { PageTitle, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

const POSITIONS: LupiPos[] = ["GK", "DEF", "MID", "ATK"];

export default function AnalyticsPage() {
  const { data: players } = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: teamRisk } = useQuery({ queryKey: ["team-risk"], queryFn: () => predictionsApi.teamRisk() });

  const roster = adaptRoster(players, teamRisk);
  const hasData = roster.length > 0;

  const top = roster.slice().sort((a, b) => b.minutes - a.minutes).slice(0, 12);
  const maxMin = hasData ? Math.max(...roster.map((p) => p.minutes), 1) : 1;

  const byPos = POSITIONS.map((pos) => {
    const ps = roster.filter((p) => p.pos === pos);
    const n = ps.length;
    return {
      pos, n,
      avgAge: n ? Math.round(ps.reduce((a, p) => a + p.age, 0) / n) : 0,
      avgMin: n ? Math.round(ps.reduce((a, p) => a + p.minutes, 0) / n) : 0,
    };
  });

  const ages = roster.map((p) => p.age).filter((a) => a > 0);
  const minAge = ages.length ? Math.min(...ages) : 0;
  const maxAge = ages.length ? Math.max(...ages) : 0;
  const ageSpan = maxAge - minAge;

  if (!hasData) {
    return (
      <div className="screen">
        <PageTitle title="Analítica" subtitle="el plantel leído en conjunto" />
        <Card>
          <div className="coming" style={{ padding: "48px 0" }}>
            <svg width="96" height="96" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="34" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="3 5" filter="url(#wobble)" />
              <circle cx="60" cy="60" r="10" fill="var(--ochre)" filter="url(#wobble)" />
            </svg>
            <Note style={{ fontSize: 18, marginTop: 8 }}>Aún no hay jugadores para analizar.</Note>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="screen">
      <PageTitle title="Analítica" subtitle="el plantel leído en conjunto" />

      <Card kicker="Línea = minutos jugados · color = posición" title="Quién carga al equipo">
        <div className="ladder">
          {top.map((p) => (
            <div className="ladder-row" key={p.id}>
              <span className="ladder-name">{p.name}</span>
              <span className="ladder-track">
                <span className="ladder-fill" style={{ width: `${(p.minutes / maxMin) * 100}%`, background: POS_COLOR[p.pos] }} />
              </span>
              <span className="ladder-val">{p.minutes.toLocaleString("es")}′</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid-1-1">
        <Card kicker="Composición del plantel" title="Por posición">
          <div className="pos-breakdown">
            {byPos.map((b) => (
              <div className="pos-bd-row" key={b.pos}>
                <span className="pos-bd-dot" style={{ background: POS_COLOR[b.pos] }} />
                <span className="pos-bd-label">{POS_LABEL[b.pos]}</span>
                <span className="pos-bd-glyphs">
                  {Array.from({ length: b.n }).map((_, i) => (
                    <span key={i} className="bd-glyph" style={{ background: POS_COLOR[b.pos] }} />
                  ))}
                </span>
                <span className="pos-bd-meta">{b.n}{b.avgAge ? ` · ${b.avgAge} años prom.` : ""}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card kicker="Cada punto es un jugador" title="Edades del plantel">
          <div className="age-strip">
            {roster.slice().filter((p) => p.age > 0).sort((a, b) => a.age - b.age).map((p) => {
              const t = ageSpan > 0 ? (p.age - minAge) / ageSpan : 0.5;
              return (
                <div key={p.id} className="age-dot-wrap" style={{ left: `${t * 100}%` }} title={`${p.name} · ${p.age}`}>
                  <span className="age-dot" style={{ background: POS_COLOR[p.pos] }} />
                </div>
              );
            })}
            <div className="age-axis" />
            <div className="age-labels"><span>{minAge || "—"}</span><span>edad →</span><span>{maxAge || "—"}</span></div>
          </div>
          <Note style={{ fontSize: 15, opacity: 0.75, display: "block", marginTop: 28 }}>
            cada punto, un jugador · color según su posición
          </Note>
        </Card>
      </div>
    </div>
  );
}
