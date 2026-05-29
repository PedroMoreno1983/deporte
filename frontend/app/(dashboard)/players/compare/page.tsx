"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { playersApi, analyticsApi } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { getPositionConfig, getStatusConfig, formatAge } from "@/lib/design-system";
import {
  GitCompare, ChevronDown, Search, X, Trophy, Minus,
} from "lucide-react";

const METRIC_KEYS = ["rendimiento", "goles", "asistencias", "minutos", "distancia", "carga"] as const;
const METRIC_LABELS: Record<string, string> = {
  rendimiento: "Rendimiento",
  goles:        "Goles",
  asistencias:  "Asistencias",
  minutos:      "Minutos",
  distancia:    "Distancia",
  carga:        "Carga",
};

const COLOR_A = "#00ff87";
const COLOR_B = "#0ea5e9";

interface PlayerPickerProps {
  label: string;
  color: string;
  selected?: any;
  onPick: (id: number) => void;
  players: any[];
  exclude?: number;
}

function PlayerPicker({ label, color, selected, onPick, players, exclude }: PlayerPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = players
    .filter((p) => p.id !== exclude)
    .filter((p) => !q || p.full_name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="relative">
      <div
        className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
        style={{ color }}
      >
        {label}
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all"
        style={{
          background: selected ? `${color}10` : "rgba(255,255,255,0.03)",
          border: `1px solid ${selected ? `${color}40` : "rgba(255,255,255,0.08)"}`,
          color: selected ? "white" : "rgba(255,255,255,0.45)",
        }}
      >
        {selected ? (
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-black text-sm shrink-0"
              style={{
                background: `${color}20`,
                border: `1px solid ${color}50`,
                color,
              }}
            >
              {selected.jersey_number ?? "?"}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-bold truncate">{selected.full_name}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {getPositionConfig(selected.position).label} · {selected.date_of_birth ? `${formatAge(selected.date_of_birth)}a` : "—"}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-sm font-medium">Seleccionar jugador...</span>
        )}
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-20 left-0 right-0 mt-2 rounded-xl overflow-hidden glass"
          style={{ border: `1px solid ${color}40`, maxHeight: 360 }}
        >
          <div className="p-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "white",
                }}
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 290 }}>
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Sin coincidencias
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onPick(p.id); setOpen(false); setQ(""); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {p.jersey_number ?? "?"}
                  </span>
                  <span className="text-sm font-semibold text-white/85 flex-1 min-w-0 truncate">
                    {p.full_name}
                  </span>
                  <span
                    className="text-[10px] font-bold tracking-wider px-1.5 rounded"
                    style={{
                      color: getPositionConfig(p.position).color,
                      background: `${getPositionConfig(p.position).color}15`,
                    }}
                  >
                    {getPositionConfig(p.position).short}
                  </span>
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function PlayerComparePage() {
  const { data: players = [] } = useQuery({
    queryKey: ["players"], queryFn: () => playersApi.list(),
  });

  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);

  const playerA = (players as any[]).find((p) => p.id === a);
  const playerB = (players as any[]).find((p) => p.id === b);

  const { data: summaryA } = useQuery({
    queryKey: ["compare-summary", a],
    queryFn: () => analyticsApi.playerSummary(a!),
    enabled: !!a,
  });
  const { data: summaryB } = useQuery({
    queryKey: ["compare-summary", b],
    queryFn: () => analyticsApi.playerSummary(b!),
    enabled: !!b,
  });
  const { data: radarA } = useQuery({
    queryKey: ["compare-radar", a],
    queryFn: () => analyticsApi.playerRadar(a!),
    enabled: !!a,
  });
  const { data: radarB } = useQuery({
    queryKey: ["compare-radar", b],
    queryFn: () => analyticsApi.playerRadar(b!),
    enabled: !!b,
  });

  const radarData = useMemo(() => {
    return METRIC_KEYS.map((k) => ({
      metric: METRIC_LABELS[k],
      a: radarA?.player?.[k] ?? 0,
      b: radarB?.player?.[k] ?? 0,
    }));
  }, [radarA, radarB]);

  const summaryRows: { label: string; a: number; b: number; higherIsBetter?: boolean }[] = [
    { label: "Partidos jugados", a: summaryA?.matches ?? 0,        b: summaryB?.matches ?? 0 },
    { label: "Goles",            a: summaryA?.goals ?? 0,          b: summaryB?.goals ?? 0 },
    { label: "Asistencias",      a: summaryA?.assists ?? 0,        b: summaryB?.assists ?? 0 },
    { label: "Rating promedio",  a: Number(summaryA?.avg_rating ?? 0), b: Number(summaryB?.avg_rating ?? 0) },
    { label: "Minutos jugados",  a: summaryA?.minutes ?? 0,        b: summaryB?.minutes ?? 0 },
  ];

  const bothSelected = !!a && !!b;
  const swap = () => { const t = a; setA(b); setB(t); };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        icon={GitCompare}
        title="Comparativa"
        description="Head-to-head entre jugadores"
        iconColor="text-[#00ff87]"
        iconBg="bg-[rgba(0,255,135,0.10)] border-[rgba(0,255,135,0.30)]"
      />

      {/* Pickers */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <PlayerPicker
            label="Jugador A"
            color={COLOR_A}
            selected={playerA}
            onPick={setA}
            players={players as any[]}
            exclude={b ?? undefined}
          />

          <div className="flex flex-col items-center gap-2 pb-2">
            <button
              onClick={swap}
              disabled={!bothSelected}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
              title="Invertir"
            >
              <GitCompare className="w-4 h-4 text-white/60" />
            </button>
            <span className="text-[10px] font-bold tracking-wider text-white/30">VS</span>
          </div>

          <PlayerPicker
            label="Jugador B"
            color={COLOR_B}
            selected={playerB}
            onPick={setB}
            players={players as any[]}
            exclude={a ?? undefined}
          />
        </div>
      </Card>

      {!bothSelected ? (
        <Card>
          <EmptyState
            illustration="data"
            title="Selecciona dos jugadores"
            description="Elige el Jugador A y el Jugador B para ver su comparativa estadística lado a lado."
          />
        </Card>
      ) : (
        <>
          {/* Identity row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ p: playerA, color: COLOR_A }, { p: playerB, color: COLOR_B }].map(({ p, color }) => {
              const pos = getPositionConfig(p?.position);
              return (
                <Card key={p?.id} className="relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                  />
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-lg shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${color}25, ${color}08)`,
                        border: `1px solid ${color}45`,
                        color,
                      }}
                    >
                      {p?.jersey_number ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-black text-white truncate">{p?.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="position" value={p?.position} />
                        <Badge variant="status" value={p?.status} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Radar */}
          <Card>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: "var(--text-muted)" }}>
              Radar comparativo
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600 }} />
                <Radar
                  name={playerA?.full_name}
                  dataKey="a"
                  stroke={COLOR_A}
                  fill={COLOR_A}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ fill: COLOR_A, r: 3, strokeWidth: 0 }}
                />
                <Radar
                  name={playerB?.full_name}
                  dataKey="b"
                  stroke={COLOR_B}
                  fill={COLOR_B}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ fill: COLOR_B, r: 3, strokeWidth: 0 }}
                />
              </RadarChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ background: COLOR_A, boxShadow: `0 0 6px ${COLOR_A}` }} />
                <span className="text-white/70 font-semibold">{playerA?.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ background: COLOR_B, boxShadow: `0 0 6px ${COLOR_B}` }} />
                <span className="text-white/70 font-semibold">{playerB?.full_name}</span>
              </div>
            </div>
          </Card>

          {/* Stat-by-stat */}
          <Card>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color: "var(--text-muted)" }}>
              Estadísticas lado a lado
            </p>
            <div className="space-y-4">
              {summaryRows.map((row) => {
                const max = Math.max(row.a, row.b, 1);
                const aWins = row.a > row.b;
                const bWins = row.b > row.a;
                const tied = row.a === row.b;
                return (
                  <div key={row.label}>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-1.5">
                      <div className="text-right">
                        <span
                          className="text-lg font-mono font-black tabular-nums"
                          style={{ color: aWins ? COLOR_A : tied ? "white" : "rgba(255,255,255,0.45)" }}
                        >
                          {typeof row.a === "number" ? row.a.toFixed(row.label.includes("Rating") ? 1 : 0) : row.a}
                        </span>
                        {aWins && <Trophy className="inline-block w-3.5 h-3.5 ml-2" style={{ color: COLOR_A }} />}
                      </div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-white/50 text-center min-w-[110px]">
                        {row.label}
                      </span>
                      <div className="text-left">
                        {bWins && <Trophy className="inline-block w-3.5 h-3.5 mr-2" style={{ color: COLOR_B }} />}
                        <span
                          className="text-lg font-mono font-black tabular-nums"
                          style={{ color: bWins ? COLOR_B : tied ? "white" : "rgba(255,255,255,0.45)" }}
                        >
                          {typeof row.b === "number" ? row.b.toFixed(row.label.includes("Rating") ? 1 : 0) : row.b}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 h-1.5">
                      <div className="bg-white/[0.04] rounded-l-full overflow-hidden flex justify-end">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(row.a / max) * 100}%` }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full"
                          style={{ background: COLOR_A, opacity: aWins ? 1 : 0.5 }}
                        />
                      </div>
                      <div className="bg-white/[0.04] rounded-r-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(row.b / max) * 100}%` }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full"
                          style={{ background: COLOR_B, opacity: bWins ? 1 : 0.5 }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Overall winner */}
            <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
              {(() => {
                const aWins = summaryRows.filter((r) => r.a > r.b).length;
                const bWins = summaryRows.filter((r) => r.b > r.a).length;
                if (aWins === bWins) {
                  return (
                    <p className="text-sm text-white/50">
                      <Minus className="inline-block w-4 h-4 mr-1.5" /> Empate técnico ({aWins} vs {bWins})
                    </p>
                  );
                }
                const winner = aWins > bWins ? playerA : playerB;
                const color = aWins > bWins ? COLOR_A : COLOR_B;
                return (
                  <p className="text-sm">
                    Mayor número de métricas favorables:{" "}
                    <span className="font-black" style={{ color }}>
                      {winner?.full_name}
                    </span>{" "}
                    <span className="text-white/40 font-mono">({Math.max(aWins, bWins)} de {summaryRows.length})</span>
                  </p>
                );
              })()}
            </div>
          </Card>

          <div className="flex justify-center pt-2">
            <button
              onClick={() => { setA(null); setB(null); }}
              className="text-xs font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-3.5 h-3.5" /> Limpiar comparativa
            </button>
          </div>
        </>
      )}
    </div>
  );
}
