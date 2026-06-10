"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { injuriesApi, analyticsApi } from "@/lib/api";
import { useRealtime } from "@/lib/ws";
import { adaptInjuries, groupInjuriesByMonth, avgDaysOut } from "@/lib/lupi-adapters";
import { REGION_COLOR } from "@/lib/lupi";
import { PageTitle, InjuryTimeline, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

export default function InjuriesPage() {
  const qc = useQueryClient();
  const { data: activeInjuries, isLoading } = useQuery({
    queryKey: ["active-injuries"],
    queryFn: () => injuriesApi.getActive(),
  });
  const { data: injuryStats } = useQuery({
    queryKey: ["injury-stats"],
    queryFn: () => analyticsApi.injuryStats(),
  });

  useRealtime("injuries", () => {
    qc.invalidateQueries({ queryKey: ["active-injuries"] });
    qc.invalidateQueries({ queryKey: ["injury-stats"] });
  });

  const raw: any[] = Array.isArray(activeInjuries) ? activeInjuries : [];
  const adapted = adaptInjuries(raw);
  const byMonth = groupInjuriesByMonth(adapted);

  // Pair each raw record with its adapted (normalized) shape, sorted by days out.
  const rows = raw
    .map((r, i) => ({ raw: r, a: adapted[i] }))
    .sort((x, y) => y.a.days - x.a.days);

  const stats = injuryStats as { active?: number; total?: number; avg_days_out?: number } | undefined;
  const kpis = [
    { n: stats?.active ?? raw.length, l: "lesiones activas", c: "var(--terracotta)" },
    { n: stats?.total ?? adapted.length, l: "históricas en el registro" },
    { n: stats?.avg_days_out ? Math.round(stats.avg_days_out) : avgDaysOut(adapted), l: "días prom. de baja", c: "var(--ochre)" },
    { n: raw.length, l: "jugadores fuera hoy" },
  ];

  return (
    <div className="screen">
      <PageTitle title="Lesiones" subtitle="el historial del semestre, como un registro a mano" />

      <div className="marginalia">
        {kpis.map((it, i) => (
          <div className="margin-item" key={i}>
            <span className="margin-num" style={{ color: it.c || "var(--ink)" }}>{it.n}</span>
            <Note style={{ fontSize: 15 }}>{it.l}</Note>
          </div>
        ))}
      </div>

      <InjuryTimeline byMonth={byMonth} note="cada barra es una baja del plantel" />

      <Card kicker="Registro de eventos · ordenado por días de baja" title="Bitácora de lesiones">
        {isLoading ? (
          <Note style={{ fontSize: 17, opacity: 0.7, display: "block", padding: "16px 4px" }}>
            leyendo el registro…
          </Note>
        ) : rows.length === 0 ? (
          <div className="coming" style={{ padding: "32px 0" }}>
            <svg width="96" height="96" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="34" fill="none" stroke="var(--ink-faint)" strokeWidth="2"
                strokeDasharray="3 5" filter="url(#wobble)" />
              <circle cx="60" cy="60" r="10" fill="var(--pine)" filter="url(#wobble)" />
            </svg>
            <Note style={{ fontSize: 18, marginTop: 8 }}>
              Sin lesiones activas.<br />El plantel está entero.
            </Note>
          </div>
        ) : (
          <div className="inj-list">
            {rows.map(({ raw: r, a }, i) => (
              <div className="inj-row" key={r.id ?? i}>
                <span className="inj-region-dot" style={{ background: REGION_COLOR[a.region] }} />
                <Link href={`/players/${r.player_id}`} className="inj-player">{a.player}</Link>
                <span className="inj-region">{a.region}</span>
                <span className="inj-month">{a.month}</span>
                <span className="inj-sev">{"•".repeat(a.severity)}</span>
                <span className="inj-days"><b>{a.days}</b> días</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
