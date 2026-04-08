"use client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { matchesApi, trainingApi, injuriesApi } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  CalendarDays, ChevronLeft, ChevronRight, Trophy,
  Dumbbell, AlertTriangle, Home, Plane, X,
} from "lucide-react";
import { useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type CalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "match" | "training" | "injury";
  title: string;
  subtitle?: string;
  color: string;
  bg: string;
  meta?: any;
};

const TYPE_CFG = {
  match:    { color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  icon: Trophy    },
  training: { color: "#00ff87", bg: "rgba(0,255,135,0.12)",   icon: Dumbbell  },
  injury:   { color: "#ff3b30", bg: "rgba(255,59,48,0.12)",   icon: AlertTriangle },
};

const SESSION_LABELS: Record<string, string> = {
  training: "Entrenamiento", match: "Partido", gym: "Gimnasio", recovery: "Recuperación",
};

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null); // YYYY-MM-DD

  // date range for queries
  const startDate = isoDate(year, month, 1);
  const endDate   = isoDate(year, month, new Date(year, month + 1, 0).getDate());

  const { data: matches = [] }   = useQuery({ queryKey: ["matches"],          queryFn: () => matchesApi.list() });
  const { data: trainings = [] } = useQuery({
    queryKey: ["training-team", startDate, endDate],
    queryFn:  () => trainingApi.getTeam({ start_date: startDate, end_date: endDate }),
  });
  const { data: activeInjuries = [] } = useQuery({ queryKey: ["active-injuries"], queryFn: () => injuriesApi.getActive() });

  // Build events map: date → CalEvent[]
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    const add = (date: string, ev: CalEvent) => {
      if (!map[date]) map[date] = [];
      map[date].push(ev);
    };

    // Matches
    (matches as any[]).forEach((m: any) => {
      const cfg = TYPE_CFG.match;
      const won  = m.goals_for != null && m.goals_against != null && m.goals_for > m.goals_against;
      const lost = m.goals_for != null && m.goals_against != null && m.goals_for < m.goals_against;
      const result = m.goals_for != null ? `${m.goals_for}–${m.goals_against}` : "Pendiente";
      add(m.date, {
        id: `match-${m.id}`,
        date: m.date,
        type: "match",
        title: m.opponent,
        subtitle: `${m.is_home ? "Local" : "Visitante"} · ${result}`,
        color: won ? "#00ff87" : lost ? "#ff3b30" : cfg.color,
        bg: won ? "rgba(0,255,135,0.12)" : lost ? "rgba(255,59,48,0.12)" : cfg.bg,
        meta: m,
      });
    });

    // Training sessions — dedupe by date (just show count + dominant type)
    const trainByDate: Record<string, any[]> = {};
    (trainings as any[]).forEach((s: any) => {
      if (!trainByDate[s.session_date]) trainByDate[s.session_date] = [];
      trainByDate[s.session_date].push(s);
    });
    Object.entries(trainByDate).forEach(([date, sessions]) => {
      const cfg = TYPE_CFG.training;
      add(date, {
        id: `training-${date}`,
        date,
        type: "training",
        title: sessions.length === 1 ? SESSION_LABELS[sessions[0].session_type] ?? sessions[0].session_type : `${sessions.length} sesiones`,
        subtitle: sessions.length === 1 ? `RPE ${sessions[0].rpe ?? "—"} · Carga ${sessions[0].session_load?.toFixed(0) ?? "—"}` : `Carga total: ${sessions.reduce((a: number, s: any) => a + (s.session_load ?? 0), 0).toFixed(0)}`,
        color: cfg.color,
        bg: cfg.bg,
        meta: sessions,
      });
    });

    // Active injuries — show on injury_date if in range
    (activeInjuries as any[]).forEach((inj: any) => {
      if (inj.injury_date >= startDate && inj.injury_date <= endDate) {
        const cfg = TYPE_CFG.injury;
        add(inj.injury_date, {
          id: `injury-${inj.id}`,
          date: inj.injury_date,
          type: "injury",
          title: inj.player_name ?? `Jugador #${inj.player_id}`,
          subtitle: inj.injury_type,
          color: cfg.color,
          bg: cfg.bg,
          meta: inj,
        });
      }
    });

    return map;
  }, [matches, trainings, activeInjuries, startDate, endDate]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Convert Sun=0 to Mon=0
  const startOffset = (firstDay + 6) % 7;
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(null); };

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : [];
  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  // Stats for the month
  const totalMatches   = Object.values(eventsByDate).flat().filter(e => e.type === "match").length;
  const totalTrainings = Object.values(eventsByDate).flat().filter(e => e.type === "training").length;
  const totalInjuries  = Object.values(eventsByDate).flat().filter(e => e.type === "injury").length;

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pl-10 sm:pl-12 lg:pl-0">
        <PageHeader
          icon={CalendarDays}
          title="Calendario"
          description="Partidos, entrenamientos y lesiones del equipo"
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10 border-cyan-500/20"
          className="mb-0 flex-1"
        />
        <button
          onClick={goToday}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
          style={{ background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.25)", color: "var(--neon)" }}
        >
          Hoy
        </button>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Partidos",       value: totalMatches,   color: "#f59e0b", icon: Trophy       },
          { label: "Entrenamientos", value: totalTrainings, color: "#00ff87", icon: Dumbbell     },
          { label: "Lesiones",       value: totalInjuries,  color: "#ff3b30", icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <GlowCard className="p-4 rounded-2xl flex items-center gap-3">
              <div className="p-2 rounded-xl shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="text-2xl font-black" style={{ color }}>{value}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      {/* Calendar + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <GlowCard className="rounded-2xl overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <button onClick={prevMonth} className="p-1.5 rounded-lg transition-colors hover:bg-white/10">
                <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
              <h2 className="text-base font-black">
                {MONTHS[month]} <span style={{ color: "var(--neon)" }}>{year}</span>
              </h2>
              <button onClick={nextMonth} className="p-1.5 rounded-lg transition-colors hover:bg-white/10">
                <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 px-3 pt-3">
              {DAYS.map(d => (
                <div key={d} className="text-center py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
              {Array.from({ length: totalCells }, (_, i) => {
                const dayNum = i - startOffset + 1;
                const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                const dateStr = isValid ? isoDate(year, month, dayNum) : "";
                const events = isValid ? (eventsByDate[dateStr] ?? []) : [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selected;
                const hasMost = (type: string) => events.filter(e => e.type === type).length > 0;

                return (
                  <motion.button
                    key={i}
                    onClick={() => isValid ? setSelected(isSelected ? null : dateStr) : undefined}
                    className="relative rounded-xl p-1 min-h-[38px] sm:min-h-[52px] flex flex-col transition-all"
                    style={{
                      background: isSelected
                        ? "rgba(0,255,135,0.1)"
                        : isToday
                        ? "rgba(255,255,255,0.05)"
                        : "transparent",
                      border: isSelected
                        ? "1px solid rgba(0,255,135,0.35)"
                        : isToday
                        ? "1px solid rgba(0,255,135,0.2)"
                        : "1px solid transparent",
                      cursor: isValid ? "pointer" : "default",
                      opacity: isValid ? 1 : 0,
                    }}
                    whileHover={isValid ? { scale: 1.04 } : {}}
                    whileTap={isValid ? { scale: 0.96 } : {}}
                  >
                    {isValid && (
                      <>
                        {/* Day number */}
                        <span
                          className="text-xs font-bold self-end leading-none mb-1 w-5 h-5 flex items-center justify-center rounded-full"
                          style={{
                            color: isToday ? "#000" : "var(--text-secondary)",
                            background: isToday ? "var(--neon)" : "transparent",
                          }}
                        >
                          {dayNum}
                        </span>

                        {/* Event dots */}
                        <div className="flex flex-col gap-0.5 w-full">
                          {hasMost("match") && (
                            <div className="w-full h-1 rounded-full" style={{ background: "#f59e0b" }} />
                          )}
                          {hasMost("training") && (
                            <div className="w-full h-1 rounded-full" style={{ background: "#00ff87" }} />
                          )}
                          {hasMost("injury") && (
                            <div className="w-full h-1 rounded-full" style={{ background: "#ff3b30" }} />
                          )}
                        </div>

                        {/* Count badge if many events */}
                        {events.length > 2 && (
                          <span className="absolute top-1 left-1 text-[8px] font-black px-1 rounded"
                            style={{ background: "rgba(255,255,255,0.12)", color: "var(--text-muted)" }}>
                            {events.length}
                          </span>
                        )}
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 pb-4 flex-wrap">
              {[
                { color: "#f59e0b", label: "Partido" },
                { color: "#00ff87", label: "Entrenamiento" },
                { color: "#ff3b30", label: "Lesión" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <div className="w-3 h-1 rounded-full" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </GlowCard>
        </div>

        {/* Detail panel */}
        <div>
          <AnimatePresence mode="wait">
            {selected && selectedEvents.length > 0 ? (
              <motion.div
                key={selected}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <GlowCard className="rounded-2xl overflow-hidden h-full">
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <div>
                      <p className="text-sm font-black text-white">
                        {new Date(selected + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{selectedEvents.length} evento{selectedEvents.length !== 1 ? "s" : ""}</p>
                    </div>
                    <button onClick={() => setSelected(null)}>
                      <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>

                  <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                    {selectedEvents.map((ev, i) => {
                      const Icon = TYPE_CFG[ev.type].icon;
                      return (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="px-5 py-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl shrink-0 mt-0.5" style={{ background: ev.bg, border: `1px solid ${ev.color}30` }}>
                              <Icon className="w-4 h-4" style={{ color: ev.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white/90">{ev.title}</p>
                              {ev.subtitle && (
                                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{ev.subtitle}</p>
                              )}

                              {/* Match extra */}
                              {ev.type === "match" && ev.meta && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                    style={{ background: ev.meta.is_home ? "rgba(14,165,233,0.12)" : "rgba(168,85,247,0.12)",
                                             color: ev.meta.is_home ? "#0ea5e9" : "#a855f7" }}>
                                    {ev.meta.is_home ? <><Home className="w-3 h-3 inline mr-1" />Local</> : <><Plane className="w-3 h-3 inline mr-1" />Visitante</>}
                                  </span>
                                  {ev.meta.competition && (
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{ev.meta.competition}</span>
                                  )}
                                </div>
                              )}

                              {/* Training sessions list */}
                              {ev.type === "training" && Array.isArray(ev.meta) && ev.meta.length > 1 && (
                                <div className="mt-2 space-y-1">
                                  {ev.meta.slice(0, 5).map((s: any) => (
                                    <div key={s.id} className="flex items-center justify-between text-xs">
                                      <span style={{ color: "var(--text-secondary)" }}>
                                        {SESSION_LABELS[s.session_type] ?? s.session_type}
                                      </span>
                                      <span className="font-mono font-bold" style={{ color: "var(--neon)" }}>
                                        RPE {s.rpe ?? "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </GlowCard>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <GlowCard className="p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-3 h-full min-h-48">
                  <div className="p-4 rounded-2xl" style={{ background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.12)" }}>
                    <CalendarDays className="w-6 h-6" style={{ color: "var(--neon)", opacity: 0.5 }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                    {selected ? "Sin eventos este día" : "Selecciona un día"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {selected ? "No hay partidos ni sesiones registrados" : "para ver los eventos del equipo"}
                  </p>
                </GlowCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upcoming events list */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Próximos eventos
            </p>
            {(() => {
              const upcoming = (matches as any[])
                .filter((m: any) => m.date >= todayStr)
                .sort((a: any, b: any) => a.date.localeCompare(b.date))
                .slice(0, 4);
              if (!upcoming.length) return (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sin partidos próximos</p>
              );
              return upcoming.map((m: any) => (
                <GlowCard key={m.id} className="px-4 py-3 rounded-xl cursor-pointer"
                  onClick={() => { setYear(Number(m.date.slice(0,4))); setMonth(Number(m.date.slice(5,7)) - 1); setSelected(m.date); }}>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg" style={{ background: "rgba(245,158,11,0.12)" }}>
                      <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white/85 truncate">vs {m.opponent}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {new Date(m.date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        {" · "}{m.is_home ? "Local" : "Visitante"}
                      </p>
                    </div>
                  </div>
                </GlowCard>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
