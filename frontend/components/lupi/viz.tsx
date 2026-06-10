"use client";
// Lupi visualizations — paper cards & hand-drawn data glyphs.
import type { CSSProperties } from "react";
import { Note, PlayerGlyph, LegendMark } from "./primitives";
import {
  type LupiPlayer, type LupiDashboard, type LupiInjuryMonth,
  type LupiWellnessDay, type LupiWellPlayer, type LupiMatch, type MatchResult,
  POS_COLOR, STATUS_COLOR, RISK_COLOR, REGION_COLOR,
  POS_LABEL, STATUS_LABEL, RISK_LABEL, polar,
} from "@/lib/lupi";

// ── Paper card ────────────────────────────────────────────────────────────────
export function Card({
  children, className = "", style, title, kicker, note,
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: React.ReactNode;
  kicker?: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <section className={"lupi-card " + className} style={style}>
      {(title || kicker || note) && (
        <header className="lupi-card-head">
          <div>
            {kicker && <div className="lupi-kicker">{kicker}</div>}
            {title && <h3 className="lupi-card-title">{title}</h3>}
          </div>
          {note && <Note style={{ fontSize: 15, opacity: 0.8, textAlign: "right", maxWidth: 160 }}>{note}</Note>}
        </header>
      )}
      {children}
    </section>
  );
}

// ── Page title ────────────────────────────────────────────────────────────────
function todayLabel(): string {
  try {
    return new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" })
      .format(new Date());
  } catch {
    return "";
  }
}

export function PageTitle({
  title, subtitle, children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1 className="page-h1">{title}</h1>
        {subtitle && <Note style={{ fontSize: 17 }}>{subtitle}</Note>}
      </div>
      <div className="page-title-right">
        {children}
        <Note style={{ fontSize: 15, opacity: 0.7, textAlign: "right" }}>
          cuaderno actualizado<br />{todayLabel()}
        </Note>
      </div>
    </div>
  );
}

// ── Squad constellation ───────────────────────────────────────────────────────
export function SquadConstellation({
  roster, dash, onSelect, selected,
}: {
  roster: LupiPlayer[];
  dash: LupiDashboard;
  onSelect: (p: LupiPlayer | null) => void;
  selected: LupiPlayer | null;
}) {
  const lines: LupiPlayer["pos"][] = ["GK", "DEF", "MID", "ATK"];
  return (
    <Card className="span-hero" kicker="El plantel, jugador por jugador" title="Cuaderno del plantel">
      <div className="constellation-wrap">
        <div className="constellation-field">
          {lines.map((pos) => {
            const players = roster.filter((p) => p.pos === pos);
            return (
              <div className="pos-line" key={pos}>
                <div className="pos-line-label">
                  <Note style={{ fontSize: 16 }}>{POS_LABEL[pos]}</Note>
                  <span className="pos-line-count">{players.length}</span>
                </div>
                <div className="pos-line-glyphs">
                  {players.map((p) => (
                    <button
                      key={p.id}
                      className={"glyph-btn" + (selected?.id === p.id ? " is-sel" : "")}
                      onClick={() => onSelect(selected?.id === p.id ? null : p)}
                      title={`${p.name} · ${STATUS_LABEL[p.status]} · ${p.minutes}′ · riesgo ${p.risk}`}
                    >
                      <PlayerGlyph p={p} box={46} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="constellation-side">
          {selected ? (
            <PlayerPeek p={selected} />
          ) : (
            <>
              <div className="big-rate">
                <span className="big-rate-num">{dash.availabilityRate}<span className="big-rate-pct">%</span></span>
                <Note style={{ fontSize: 16, display: "block", marginTop: 2 }}>
                  del plantel disponible — {dash.available} de {dash.total}
                </Note>
              </div>
              <ConstellationLegend />
              <Note style={{ fontSize: 15, opacity: 0.75, display: "block", marginTop: 14 }}>
                ↑ toca cualquier jugador para leer su ficha
              </Note>
            </>
          )}
        </aside>
      </div>
    </Card>
  );
}

export function ConstellationLegend() {
  const items: { kind: LupiPlayer["status"]; label: string }[] = [
    { kind: "available", label: "disponible" },
    { kind: "recovering", label: "en recuperación" },
    { kind: "injured", label: "lesionado" },
    { kind: "suspended", label: "suspendido" },
  ];
  return (
    <div className="leg-block">
      <div className="leg-title">Cómo leer cada marca</div>
      <div className="leg-rows">
        {items.map((it) => (
          <div className="leg-row" key={it.kind}>
            <LegendMark kind={it.kind} color="var(--ink)" size={22} />
            <Note style={{ fontSize: 15 }}>{it.label}</Note>
          </div>
        ))}
      </div>
      <div className="leg-encodings">
        <div><span className="leg-dim color">color</span> = posición</div>
        <div><span className="leg-dim size">tamaño</span> = minutos jugados</div>
        <div><span className="leg-dim arc">arco</span> = riesgo de lesión</div>
      </div>
    </div>
  );
}

export function PlayerPeek({ p }: { p: LupiPlayer }) {
  return (
    <div className="peek">
      <div className="peek-top">
        <PlayerGlyph p={p} box={58} />
        <div>
          <div className="peek-name">{p.name}</div>
          <Note style={{ fontSize: 15 }}>{POS_LABEL[p.pos]} · {p.age} años</Note>
        </div>
      </div>
      <div className="peek-rows">
        <div className="peek-row"><span>Estado</span><b style={{ color: STATUS_COLOR[p.status] }}>{STATUS_LABEL[p.status]}</b></div>
        <div className="peek-row"><span>Minutos</span><b>{p.minutes.toLocaleString("es")}′</b></div>
        <div className="peek-row"><span>Riesgo</span><b style={{ color: RISK_COLOR[p.riskLevel] }}>{p.risk} · {RISK_LABEL[p.riskLevel]}</b></div>
        {p.body && <div className="peek-row"><span>Zona sensible</span><b>{p.body}</b></div>}
      </div>
      <Note style={{ fontSize: 14, opacity: 0.7, display: "block", marginTop: 10 }}>
        toca de nuevo para volver a la leyenda
      </Note>
    </div>
  );
}

export function PlayerPeekFull({ p, onClose }: { p: LupiPlayer; onClose: () => void }) {
  const first = p.name.split(" ")[0];
  return (
    <div className="peek-full">
      <button className="drawer-x" onClick={onClose} aria-label="Cerrar">×</button>
      <div className="peek-top">
        <PlayerGlyph p={p} box={72} />
        <div>
          <div className="peek-name" style={{ fontSize: 26 }}>{p.name}</div>
          <Note style={{ fontSize: 16 }}>{POS_LABEL[p.pos]} · {p.age} años</Note>
        </div>
      </div>
      <div className="peek-rows">
        <div className="peek-row"><span>Estado</span><b style={{ color: STATUS_COLOR[p.status] }}>{STATUS_LABEL[p.status]}</b></div>
        <div className="peek-row"><span>Minutos en la temporada</span><b>{p.minutes.toLocaleString("es")}′</b></div>
        <div className="peek-row"><span>Riesgo de lesión</span><b style={{ color: RISK_COLOR[p.riskLevel] }}>{p.risk} · {RISK_LABEL[p.riskLevel]}</b></div>
        {p.body && <div className="peek-row"><span>Zona sensible</span><b>{p.body}</b></div>}
      </div>
      <Note style={{ fontSize: 16, opacity: 0.8, marginTop: 14, display: "block" }}>
        “{first} viene cargando {p.minutes}′ esta temporada{p.body ? `, con molestias en ${p.body}` : ""}. {p.risk >= 60 ? "Conviene dosificar sus minutos." : "Sin alertas mayores por ahora."}”
      </Note>
    </div>
  );
}

// ── Injury timeline ───────────────────────────────────────────────────────────
export function InjuryTimeline({ byMonth, note }: { byMonth: LupiInjuryMonth[]; note?: React.ReactNode }) {
  const maxDays = 96;
  const colH = 150;
  const regions = Object.keys(REGION_COLOR);
  return (
    <Card kicker="Una marca por lesión · altura = días de baja" title="El semestre, mes a mes" note={note}>
      <div className="timeline">
        {byMonth.map((m) => (
          <div className="tl-col" key={m.month}>
            <div className="tl-stack" style={{ height: colH }}>
              {m.items.slice().sort((a, b) => b.days - a.days).map((inj, i) => {
                const h = 8 + (inj.days / maxDays) * (colH - 12);
                return (
                  <div className="tl-mark-wrap" key={i} title={`${inj.player} · ${inj.region} · ${inj.days} días`}>
                    <svg width={20} height={h} style={{ overflow: "visible" }}>
                      <rect x={5} y={1} width={10} height={h - 2} rx={5}
                        fill={REGION_COLOR[inj.region]} opacity={0.55 + inj.severity * 0.15} filter="url(#wobble)" />
                    </svg>
                  </div>
                );
              })}
            </div>
            <div className="tl-axis" />
            <div className="tl-month">{m.month}</div>
            <div className="tl-count">{m.items.length}</div>
          </div>
        ))}
      </div>
      <div className="tl-legend">
        {regions.map((r) => (
          <div className="tl-leg-item" key={r}>
            <span className="tl-dot" style={{ background: REGION_COLOR[r] }} />
            <span>{r}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Risk ledger ───────────────────────────────────────────────────────────────
export function RiskLedger({ roster, onSelect }: { roster: LupiPlayer[]; onSelect: (p: LupiPlayer) => void }) {
  const top = roster.slice().sort((a, b) => b.risk - a.risk).slice(0, 6);
  const TICKS = 12;
  return (
    <Card kicker="Según el modelo predictivo" title="A quién cuidar esta semana">
      <div className="ledger">
        {top.map((p, idx) => {
          const filled = Math.round((p.risk / 100) * TICKS);
          return (
            <button className="ledger-row" key={p.id} onClick={() => onSelect(p)}>
              <span className="ledger-rank">{idx + 1}</span>
              <span className="ledger-pos" style={{ background: POS_COLOR[p.pos] }} title={POS_LABEL[p.pos]} />
              <span className="ledger-name">{p.name}</span>
              <span className="ledger-ticks">
                {Array.from({ length: TICKS }).map((_, i) => (
                  <span key={i} className="tick"
                    style={{ background: i < filled ? RISK_COLOR[p.riskLevel] : "transparent",
                             borderColor: i < filled ? RISK_COLOR[p.riskLevel] : "var(--rule)" }} />
                ))}
              </span>
              <Note style={{ fontSize: 14, color: RISK_COLOR[p.riskLevel], width: 52, textAlign: "right" }}>
                {RISK_LABEL[p.riskLevel]}
              </Note>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Wellness week ─────────────────────────────────────────────────────────────
export function WellnessWeek({ data }: { data: LupiWellnessDay[] }) {
  const measures = [
    { key: "sleep" as const, label: "sueño", color: "var(--slate)" },
    { key: "mood" as const, label: "ánimo", color: "var(--pine)" },
    { key: "soreness" as const, label: "dolor", color: "var(--terracotta)" },
    { key: "load" as const, label: "carga", color: "var(--ochre)" },
  ];
  return (
    <Card kicker="Auto-reporte diario del plantel" title="Cómo se sintió la semana">
      <div className="wellness">
        {data.map((d) => (
          <div className="well-col" key={d.day}>
            <div className="well-marks">
              {measures.map((m) => (
                <div className="well-cell" key={m.key} title={`${m.label}: ${d[m.key]}/5`}>
                  <svg width={16} height={16}>
                    <circle cx={8} cy={8} r={2 + (d[m.key] / 5) * 5} fill={m.color}
                      opacity={0.3 + (d[m.key] / 5) * 0.7} filter="url(#wobble)" />
                  </svg>
                </div>
              ))}
            </div>
            <div className="well-day">{d.day}</div>
          </div>
        ))}
      </div>
      <div className="well-legend">
        {measures.map((m) => (
          <div className="well-leg" key={m.key}>
            <span className="tl-dot" style={{ background: m.color }} />{m.label}
          </div>
        ))}
        <Note style={{ fontSize: 14, opacity: 0.7, marginLeft: "auto" }}>círculo grande = más intenso</Note>
      </div>
    </Card>
  );
}

// ── Wellness flower (radar-ish) ───────────────────────────────────────────────
export function WellFlower({ p, size = 64 }: { p: LupiWellPlayer; size?: number }) {
  const c = size / 2;
  const petals = [
    { key: "sleep" as const, color: "var(--slate)", deg: 0 },
    { key: "load" as const, color: "var(--ochre)", deg: 90 },
    { key: "soreness" as const, color: "var(--terracotta)", deg: 180 },
    { key: "mood" as const, color: "var(--pine)", deg: 270 },
  ];
  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      <g filter="url(#wobble)">
        {petals.map((pt) => {
          const len = 6 + (p[pt.key] / 5) * (c - 8);
          const [x, y] = polar(c, c, len, pt.deg);
          return <line key={pt.key} x1={c} y1={c} x2={x} y2={y} stroke={pt.color} strokeWidth={5.5} strokeLinecap="round" opacity={0.88} />;
        })}
        <circle cx={c} cy={c} r={3} fill="var(--ink)" />
      </g>
    </svg>
  );
}

// ── Match result glyph ────────────────────────────────────────────────────────
const RES_COLOR: Record<MatchResult, string> = { W: "var(--pine)", D: "var(--ochre)", L: "var(--terracotta)" };

export function ResultGlyph({ r, size = 30, faded = false }: { r: MatchResult | null; size?: number; faded?: boolean }) {
  const c = size / 2, rad = size * 0.38;
  if (!r) return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={rad} fill="none" stroke="var(--ink-faint)" strokeWidth={1.5} strokeDasharray="2 3" filter="url(#wobble)" />
      <text x={c} y={c + 4} textAnchor="middle" className="match-res" fill="var(--ink-faint)">?</text>
    </svg>
  );
  return (
    <svg width={size} height={size}>
      {r === "W"
        ? <circle cx={c} cy={c} r={rad} fill={RES_COLOR[r]} filter="url(#wobble)" opacity={faded ? 0.5 : 1} />
        : <circle cx={c} cy={c} r={rad} fill={r === "D" ? "none" : RES_COLOR[r]} stroke={RES_COLOR[r]} strokeWidth={2} filter="url(#wobble)" opacity={faded ? 0.5 : 1} />}
      <text x={c} y={c + 5} textAnchor="middle" className="match-res"
        fill={r === "W" ? "var(--paper-card)" : r === "L" ? "var(--paper-card)" : RES_COLOR[r]}>{r}</text>
    </svg>
  );
}

// ── Matches ribbon ────────────────────────────────────────────────────────────
export function MatchesRibbon({ matches }: { matches: LupiMatch[] }) {
  const RES_LABEL: Record<MatchResult, string> = { W: "ganó", D: "empató", L: "perdió" };
  return (
    <Card kicker="Últimos resultados y lo que viene" title="El calendario">
      <div className="matches">
        {matches.map((m) => (
          <div className={"match" + (!m.played ? " is-next" : "")} key={m.id}>
            <div className="match-mark"><ResultGlyph r={m.result} size={34} /></div>
            <div className="match-body">
              <div className="match-opp">{m.home ? "vs" : "@"} {m.opp}</div>
              <div className="match-meta">
                {m.played
                  ? <><b>{m.gf}–{m.ga}</b> · {m.result ? RES_LABEL[m.result] : ""}</>
                  : <Note style={{ fontSize: 15 }}>próximo · {m.date}</Note>}
              </div>
            </div>
            <div className="match-date">{m.played ? m.date : ""}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Marginalia (small handwritten KPI notes) ──────────────────────────────────
export function Marginalia({ dash }: { dash: LupiDashboard }) {
  const items = [
    { n: dash.total, l: "jugadores en plantel" },
    { n: dash.activeInjuries, l: "lesiones activas", c: "var(--terracotta)" },
    { n: dash.recovering, l: "en recuperación", c: "var(--ochre)" },
    { n: dash.avgDaysOut, l: "días prom. de baja" },
    { n: dash.recentMatches, l: "partidos jugados" },
  ];
  return (
    <div className="marginalia">
      {items.map((it, i) => (
        <div className="margin-item" key={i}>
          <span className="margin-num" style={{ color: it.c || "var(--ink)" }}>{it.n}</span>
          <Note style={{ fontSize: 15 }}>{it.l}</Note>
        </div>
      ))}
    </div>
  );
}
