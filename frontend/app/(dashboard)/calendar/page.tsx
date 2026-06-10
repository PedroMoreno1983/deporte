"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { matchesApi, trainingApi, injuriesApi } from "@/lib/api";
import { PageTitle, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

type EvType = "match" | "training" | "injury";
type CalEvent = { id: string; type: EvType; title: string; subtitle?: string };

const EV_COLOR: Record<EvType, string> = {
  match: "var(--terracotta)",
  training: "var(--pine)",
  injury: "var(--ochre)",
};
const EV_LABEL: Record<EvType, string> = { match: "partido", training: "entrenamiento", injury: "lesión" };
const SESSION_LABELS: Record<string, string> = {
  training: "Entrenamiento", match: "Partido", gym: "Gimnasio", recovery: "Recuperación",
};
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const startDate = isoDate(year, month, 1);
  const endDate = isoDate(year, month, new Date(year, month + 1, 0).getDate());

  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: () => matchesApi.list() });
  const { data: trainings = [] } = useQuery({
    queryKey: ["training-team", startDate, endDate],
    queryFn: () => trainingApi.getTeam({ start_date: startDate, end_date: endDate }),
  });
  const { data: activeInjuries = [] } = useQuery({ queryKey: ["active-injuries"], queryFn: () => injuriesApi.getActive() });

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    const add = (date: string, ev: CalEvent) => { (map[date] ||= []).push(ev); };

    (matches as any[]).forEach((m: any) => {
      const result = m.goals_for != null ? `${m.goals_for}–${m.goals_against}` : "pendiente";
      add(m.date, { id: `match-${m.id}`, type: "match", title: `${m.is_home ? "vs" : "@"} ${m.opponent}`, subtitle: `${m.is_home ? "local" : "visita"} · ${result}` });
    });

    const trainByDate: Record<string, any[]> = {};
    (trainings as any[]).forEach((s: any) => { (trainByDate[s.session_date] ||= []).push(s); });
    Object.entries(trainByDate).forEach(([date, sessions]) => {
      add(date, {
        id: `training-${date}`,
        type: "training",
        title: sessions.length === 1 ? (SESSION_LABELS[sessions[0].session_type] ?? sessions[0].session_type) : `${sessions.length} sesiones`,
        subtitle: sessions.length === 1 ? `RPE ${sessions[0].rpe ?? "—"}` : `carga total ${sessions.reduce((a: number, s: any) => a + (s.session_load ?? 0), 0).toFixed(0)}`,
      });
    });

    (activeInjuries as any[]).forEach((inj: any) => {
      if (inj.injury_date >= startDate && inj.injury_date <= endDate) {
        add(inj.injury_date, { id: `injury-${inj.id}`, type: "injury", title: inj.player_name ?? `Jugador #${inj.player_id}`, subtitle: inj.injury_type });
      }
    });
    return map;
  }, [matches, trainings, activeInjuries, startDate, endDate]);

  const jsFirst = new Date(year, month, 1).getDay();
  const firstWeekday = (jsFirst + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); setSelected(null); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); setSelected(null); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(null); };

  const totals = (t: EvType) => Object.values(eventsByDate).flat().filter((e) => e.type === t).length;
  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : [];

  return (
    <div className="screen">
      <PageTitle title="Calendario" subtitle="el mes como una hoja de cuaderno" />

      <div className="filter-bar">
        <button className="chip" onClick={prevMonth}>← anterior</button>
        <button className="chip is-on" onClick={goToday}>hoy</button>
        <button className="chip" onClick={nextMonth}>siguiente →</button>
        <Note style={{ fontSize: 17, marginLeft: 8 }}>{MONTHS[month]} {year}</Note>
        <Note style={{ fontSize: 15, marginLeft: "auto", opacity: 0.75 }}>
          {totals("match")} partidos · {totals("training")} entrenamientos · {totals("injury")} lesiones
        </Note>
      </div>

      <Card kicker={`${MONTHS[month]} ${year}`} title="El mes de un vistazo" note="cada punto es un compromiso del plantel">
        <div className="cal-grid">
          {WEEKDAYS.map((w) => <div className="cal-wd" key={w}>{w}</div>)}
          {cells.map((d, i) => {
            if (d === null) return <div className="cal-cell empty" key={"e" + i} />;
            const dateStr = isoDate(year, month, d);
            const evs = eventsByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isSel = dateStr === selected;
            const types = Array.from(new Set(evs.map((e) => e.type)));
            return (
              <div
                className={"cal-cell" + (isToday ? " today" : "")}
                key={d}
                onClick={() => setSelected(isSel ? null : dateStr)}
                style={{ cursor: "pointer", borderColor: isSel ? "var(--terracotta)" : undefined }}
              >
                <span className="cal-num">{d}</span>
                {isToday && <span className="cal-today-ring" />}
                <div className="cal-evs">
                  {types.map((t) => (
                    <span key={t} className={"cal-ev" + (t === "match" ? " match" : "")} style={{ background: EV_COLOR[t] }} title={EV_LABEL[t]} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="tl-legend">
          {(["match", "training", "injury"] as EvType[]).map((t) => (
            <div className="tl-leg-item" key={t}>
              <span className={"tl-dot" + (t === "match" ? " sq" : "")} style={{ background: EV_COLOR[t] }} />{EV_LABEL[t]}
            </div>
          ))}
          <Note style={{ fontSize: 15, marginLeft: "auto", opacity: 0.75 }}>el círculo a mano marca hoy</Note>
        </div>
      </Card>

      {selected && (
        <Card
          kicker={new Date(selected + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
          title={`${selectedEvents.length} evento${selectedEvents.length !== 1 ? "s" : ""} este día`}
        >
          {selectedEvents.length === 0 ? (
            <Note style={{ fontSize: 16, opacity: 0.7 }}>sin partidos ni sesiones registrados este día</Note>
          ) : (
            <div className="inj-list">
              {selectedEvents.map((ev) => (
                <div className="inj-row" key={ev.id}>
                  <span className="inj-region-dot" style={{ background: EV_COLOR[ev.type] }} />
                  <span className="inj-player">{ev.title}</span>
                  <span className="inj-region" style={{ marginLeft: "auto" }}>{ev.subtitle}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
