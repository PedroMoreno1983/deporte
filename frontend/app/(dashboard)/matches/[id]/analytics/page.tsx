"use client";
/**
 * Spatial match analytics: xG, shot map, pass network, possession & field tilt.
 * Consumes GET /matches/{id}/analytics (computed from MatchEvent rows by the
 * backend app.analytics engine). All pitch viz is plain SVG — no chart lib.
 */
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { matchesApi, type MatchAnalytics, type TeamAnalytics, type ShotRec } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ArrowLeft, Crosshair, Loader2, Goal, Share2, Activity } from "lucide-react";
import Link from "next/link";

const OWN = "#00ff87";   // own team (neon green, matches the app accent)
const OPP = "#f5a524";   // opponent (amber)

// Wyscout 0-100 -> metres on a 105x68 pitch.
const mx = (x: number) => (x / 100) * 105;
const my = (y: number) => (y / 100) * 68;

function teamColors(a: MatchAnalytics): Record<string, string> {
  const teams = a.meta.teams;
  const own = a.meta.own_team;
  const out: Record<string, string> = {};
  teams.forEach((t, i) => {
    out[t] = own ? (t === own ? OWN : OPP) : i === 0 ? OWN : OPP;
  });
  return out;
}

// ── Pitch backdrop (horizontal, attacking right) ─────────────────────────────
function Pitch({ children, height = 320 }: { children?: React.ReactNode; height?: number }) {
  const line = "rgba(255,255,255,0.22)";
  return (
    <svg viewBox="0 0 105 68" width="100%" height={height} style={{ display: "block" }}>
      <rect x="0" y="0" width="105" height="68" rx="1.5"
        fill="rgba(0,255,135,0.04)" stroke={line} strokeWidth="0.4" />
      <line x1="52.5" y1="0" x2="52.5" y2="68" stroke={line} strokeWidth="0.3" />
      <circle cx="52.5" cy="34" r="9.15" fill="none" stroke={line} strokeWidth="0.3" />
      <circle cx="52.5" cy="34" r="0.6" fill={line} />
      {/* Penalty + goal areas, both ends */}
      {[0, 1].map((side) => {
        const f = side === 0;
        const bx = f ? 0 : 105 - 16.5;
        const gx = f ? 0 : 105 - 5.5;
        return (
          <g key={side}>
            <rect x={bx} y={(68 - 40.3) / 2} width="16.5" height="40.3" fill="none" stroke={line} strokeWidth="0.3" />
            <rect x={gx} y={(68 - 18.32) / 2} width="5.5" height="18.32" fill="none" stroke={line} strokeWidth="0.3" />
            <rect x={f ? -0.8 : 105} y={(68 - 7.32) / 2} width="0.8" height="7.32" fill={line} />
            <circle cx={f ? 11 : 94} cy="34" r="0.5" fill={line} />
          </g>
        );
      })}
      {children}
    </svg>
  );
}

// ── Shot map: both teams on one pitch (opponent mirrored to attack left) ──────
function ShotMap({ a, colors }: { a: MatchAnalytics; colors: Record<string, string> }) {
  const own = a.meta.own_team;
  const shots: { px: number; py: number; r: number; fill: string; goal: boolean; pen: boolean }[] = [];
  for (const t of a.meta.teams) {
    const attacksRight = own ? t === own : t === a.meta.teams[0];
    for (const s of a.teams[t].shot_map) {
      const X = mx(s.x), Y = my(s.y);
      shots.push({
        px: attacksRight ? X : 105 - X,
        py: attacksRight ? Y : 68 - Y,
        r: 0.9 + Math.sqrt(s.xg) * 3.2,
        fill: colors[t],
        goal: s.is_goal,
        pen: s.is_penalty,
      });
    }
  }
  return (
    <Pitch>
      {shots.map((s, i) => (
        <g key={i}>
          <circle cx={s.px} cy={s.py} r={s.r} fill={s.fill}
            fillOpacity={s.goal ? 0.95 : 0.45} stroke={s.goal ? "#fff" : s.fill}
            strokeWidth={s.goal ? 0.5 : 0.3} />
          {s.pen && <circle cx={s.px} cy={s.py} r={s.r + 0.8} fill="none" stroke="#fff" strokeWidth="0.25" strokeDasharray="0.6 0.6" />}
        </g>
      ))}
    </Pitch>
  );
}

// ── Pass network (own team only; opponent players aren't resolved) ───────────
function PassNetwork({ team, color }: { team: TeamAnalytics; color: string }) {
  const nodes = team.pass_network.nodes;
  const edges = team.pass_network.edges;
  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center text-xs text-white/40" style={{ height: 320 }}>
        Red de pases disponible solo para el equipo propio (los jugadores rivales no se resuelven).
      </div>
    );
  }
  const pos = new Map(nodes.map((n) => [n.player_id, { x: mx(n.avg_x), y: my(n.avg_y) }]));
  const maxEdge = Math.max(1, ...edges.map((e) => e.count));
  const maxInv = Math.max(1, ...nodes.map((n) => n.involvements));
  return (
    <Pitch>
      {edges.map((e, i) => {
        const f = pos.get(e.from), t = pos.get(e.to);
        if (!f || !t) return null;
        return (
          <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke={color}
            strokeOpacity={0.12 + 0.55 * (e.count / maxEdge)}
            strokeWidth={0.2 + 1.6 * (e.count / maxEdge)} strokeLinecap="round" />
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.player_id)!;
        const r = 1.4 + 2.6 * (n.involvements / maxInv);
        return (
          <g key={n.player_id}>
            <circle cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={0.8} stroke="#0b0f0c" strokeWidth="0.3" />
            <text x={p.x} y={p.y + 0.9} textAnchor="middle" fontSize="2.1" fill="#06120c" fontWeight="700">
              {n.player_id}
            </text>
          </g>
        );
      })}
    </Pitch>
  );
}

// ── Cumulative-xG step timeline (custom SVG) ─────────────────────────────────
function XgTimeline({ a, colors }: { a: MatchAnalytics; colors: Record<string, string> }) {
  const W = 100, H = 42, pad = 4;
  const maxMin = Math.max(90, ...a.meta.teams.flatMap((t) => a.teams[t].xg_timeline.map((p) => p.minute)));
  const maxXg = Math.max(0.5, ...a.meta.teams.map((t) => a.teams[t].xg_total));
  const sx = (m: number) => pad + (m / maxMin) * (W - 2 * pad);
  const sy = (v: number) => H - pad - (v / maxXg) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={170} style={{ display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad} y1={sy(maxXg * f)} x2={W - pad} y2={sy(maxXg * f)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.2" />
      ))}
      <line x1={sx(45)} y1={pad} x2={sx(45)} y2={H - pad} stroke="rgba(255,255,255,0.12)" strokeWidth="0.2" strokeDasharray="0.8 0.8" />
      {a.meta.teams.map((t) => {
        const tl = a.teams[t].xg_timeline;
        if (!tl.length) return null;
        let d = `M ${sx(0)} ${sy(0)}`;
        let prev = 0;
        for (const p of tl) { d += ` L ${sx(p.minute)} ${sy(prev)} L ${sx(p.minute)} ${sy(p.cumulative)}`; prev = p.cumulative; }
        d += ` L ${sx(maxMin)} ${sy(prev)}`;
        return (
          <g key={t}>
            <path d={d} fill="none" stroke={colors[t]} strokeWidth="0.7" />
            {tl.filter((p) => p.is_goal).map((p, i) => (
              <circle key={i} cx={sx(p.minute)} cy={sy(p.cumulative)} r="0.9" fill={colors[t]} stroke="#fff" strokeWidth="0.25" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function Bar({ left, right, lc, rc }: { left: number; right: number; lc: string; rc: string }) {
  const tot = left + right || 1;
  const lp = (left / tot) * 100;
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5">
      <div style={{ width: `${lp}%`, background: lc }} />
      <div style={{ width: `${100 - lp}%`, background: rc }} />
    </div>
  );
}

const META: { key: keyof TeamAnalytics | string; label: string; fmt?: (t: TeamAnalytics) => string }[] = [
  { key: "shots", label: "Remates", fmt: (t) => String(t.shots) },
  { key: "shots_on_target", label: "Al arco", fmt: (t) => String(t.shots_on_target) },
  { key: "xg_total", label: "xG", fmt: (t) => t.xg_total.toFixed(2) },
  { key: "xg_per_shot", label: "xG / remate", fmt: (t) => t.xg_per_shot.toFixed(3) },
  { key: "possession_pct", label: "Posesión", fmt: (t) => `${t.possession_pct}%` },
  { key: "field_tilt_pct", label: "Field tilt", fmt: (t) => `${t.field_tilt_pct}%` },
  { key: "acc", label: "Precisión de pase", fmt: (t) => `${Math.round(t.passing.accuracy * 100)}%` },
  { key: "prog", label: "Pases progresivos", fmt: (t) => String(t.passing.progressive) },
  { key: "ft", label: "Pases al último tercio", fmt: (t) => String(t.passing.into_final_third) },
  { key: "box", label: "Pases al área", fmt: (t) => String(t.passing.into_box) },
];

export default function MatchAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["match-analytics", id],
    queryFn: () => matchesApi.analytics(id),
    enabled: Number.isFinite(id),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-white/50"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (isError || !data) {
    return <div className="py-20 text-center text-white/50">No se pudo cargar la analítica del partido.</div>;
  }

  const a = data as MatchAnalytics;
  const colors = teamColors(a);
  const teams = a.meta.teams;
  // Need both sides for the comparative view (Wyscout exports always carry two
  // team names); guards against undefined-team access if only one resolves.
  const hasData = teams.length >= 2 && a.meta.n_events > 0;
  const [tA, tB] = teams;

  return (
    <div className="space-y-5 pb-10">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <PageHeader
        title="Analítica del partido"
        subtitle={[a.match.competition, a.match.opponent ? `vs ${a.match.opponent}` : null, a.match.date].filter(Boolean).join(" · ")}
        icon={Crosshair}
        iconColor="text-[#00ff87]"
      />

      {!hasData ? (
        <GlowCard className="p-8 text-center">
          <Activity className="w-8 h-8 mx-auto mb-3 text-white/30" />
          <p className="text-white/70 font-medium">Este partido todavía no tiene eventos importados.</p>
          <p className="text-white/45 text-sm mt-1">
            Subí un export de eventos de Wyscout (Importaciones → Wyscout — Eventos de partido)
            para ver xG, mapa de remates y redes de pase.
          </p>
        </GlowCard>
      ) : (
        <>
          {/* Scoreline + xG headline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlowCard className="p-5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Marcador</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: colors[tA] }}>{tA}</span>
                <span className="text-3xl font-bold tabular-nums">{a.scoreline[tA]} <span className="text-white/30">–</span> {a.scoreline[tB]}</span>
                <span className="text-sm font-semibold text-right" style={{ color: colors[tB] }}>{tB}</span>
              </div>
            </GlowCard>
            <GlowCard className="p-5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Goles esperados (xG)</p>
              <div className="flex items-center justify-between mb-2 text-2xl font-bold tabular-nums">
                <span style={{ color: colors[tA] }}>{a.xg[tA].toFixed(2)}</span>
                <span style={{ color: colors[tB] }}>{a.xg[tB].toFixed(2)}</span>
              </div>
              <Bar left={a.xg[tA]} right={a.xg[tB]} lc={colors[tA]} rc={colors[tB]} />
            </GlowCard>
            <GlowCard className="p-5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Posesión</p>
              <div className="flex items-center justify-between mb-2 text-2xl font-bold tabular-nums">
                <span style={{ color: colors[tA] }}>{a.possession_pct[tA]}%</span>
                <span style={{ color: colors[tB] }}>{a.possession_pct[tB]}%</span>
              </div>
              <Bar left={a.possession_pct[tA]} right={a.possession_pct[tB]} lc={colors[tA]} rc={colors[tB]} />
            </GlowCard>
          </div>

          {/* Shot map + xG timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlowCard className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Goal className="w-4 h-4 text-[#00ff87]" />
                <h3 className="text-sm font-semibold">Mapa de remates</h3>
                <span className="text-[11px] text-white/40 ml-auto">tamaño ∝ xG · relleno = gol</span>
              </div>
              <ShotMap a={a} colors={colors} />
              <div className="flex items-center justify-center gap-5 mt-3 text-[11px] text-white/55">
                <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colors[tA] }} />{tA} →</span>
                <span className="flex items-center gap-1.5">← {tB}<i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colors[tB] }} /></span>
              </div>
            </GlowCard>
            <GlowCard className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-[#00ff87]" />
                <h3 className="text-sm font-semibold">Carrera de xG acumulado</h3>
                <span className="text-[11px] text-white/40 ml-auto">línea punteada = descanso</span>
              </div>
              <XgTimeline a={a} colors={colors} />
              <div className="flex items-center justify-between mt-2 text-[11px] text-white/55">
                <span style={{ color: colors[tA] }}>{tA}: {a.xg[tA].toFixed(2)} xG</span>
                <span style={{ color: colors[tB] }}>{tB}: {a.xg[tB].toFixed(2)} xG</span>
              </div>
            </GlowCard>
          </div>

          {/* Pass network (own team) */}
          <GlowCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-[#00ff87]" />
              <h3 className="text-sm font-semibold">
                Red de pases — {a.meta.own_team ?? tA}
              </h3>
              <span className="text-[11px] text-white/40 ml-auto">nodo ∝ intervenciones · arista ∝ volumen de pases · ataca →</span>
            </div>
            <PassNetwork team={a.teams[a.meta.own_team ?? tA]} color={colors[a.meta.own_team ?? tA]} />
          </GlowCard>

          {/* Metrics table */}
          <GlowCard className="p-5">
            <h3 className="text-sm font-semibold mb-3">Resumen comparativo</h3>
            <div className="space-y-1.5">
              <div className="grid grid-cols-3 text-[11px] uppercase tracking-wider text-white/35 pb-1">
                <span style={{ color: colors[tA] }}>{tA}</span>
                <span className="text-center">Métrica</span>
                <span className="text-right" style={{ color: colors[tB] }}>{tB}</span>
              </div>
              {META.map((m) => (
                <div key={m.label} className="grid grid-cols-3 items-center py-1.5 border-t border-white/5 text-sm tabular-nums">
                  <span className="font-semibold" style={{ color: colors[tA] }}>{m.fmt!(a.teams[tA])}</span>
                  <span className="text-center text-white/50 text-xs">{m.label}</span>
                  <span className="font-semibold text-right" style={{ color: colors[tB] }}>{m.fmt!(a.teams[tB])}</span>
                </div>
              ))}
            </div>
          </GlowCard>
        </>
      )}
    </div>
  );
}
