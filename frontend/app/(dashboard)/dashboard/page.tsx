"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { playersApi, predictionsApi, injuriesApi, analyticsApi, matchesApi } from "@/lib/api";
import {
  adaptRoster, adaptInjuries, groupInjuriesByMonth, buildDashboard, adaptMatches, avgDaysOut,
} from "@/lib/lupi-adapters";
import { SAMPLE_WELLNESS_WEEK } from "@/lib/lupi-fallbacks";
import type { LupiPlayer } from "@/lib/lupi";
import { PageTitle, SquadConstellation, InjuryTimeline, RiskLedger, WellnessWeek, MatchesRibbon, Marginalia } from "@/components/lupi/viz";

export default function DashboardPage() {
  const [selected, setSelected] = useState<LupiPlayer | null>(null);

  const { data: players } = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: teamRisk } = useQuery({ queryKey: ["team-risk"], queryFn: () => predictionsApi.teamRisk() });
  const { data: activeInjuries } = useQuery({ queryKey: ["active-injuries"], queryFn: () => injuriesApi.getActive() });
  const { data: injuryStats } = useQuery({ queryKey: ["injury-stats"], queryFn: () => analyticsApi.injuryStats() });
  const { data: matchesRaw } = useQuery({ queryKey: ["matches"], queryFn: () => matchesApi.list() });

  const roster = adaptRoster(players, teamRisk);
  const injuries = adaptInjuries(activeInjuries);
  const byMonth = groupInjuriesByMonth(injuries);

  const matches = adaptMatches(matchesRaw)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const recentMatches = matches.filter((m) => m.played).length;

  const stats = injuryStats as { avg_days_out?: number } | undefined;
  const dash = buildDashboard(roster, {
    avgDaysOut: stats?.avg_days_out ? Math.round(stats.avg_days_out) : avgDaysOut(injuries),
    recentMatches,
  });

  return (
    <div className="screen">
      <PageTitle title="Resumen del equipo" subtitle="todo el plantel en una sola página, como un diario">
        <span className="live-tag"><span className="live-dot" /> en vivo</span>
      </PageTitle>

      <SquadConstellation roster={roster} dash={dash} selected={selected} onSelect={setSelected} />

      <div className="grid-2-1">
        <InjuryTimeline byMonth={byMonth} note="el semestre, lesión a lesión" />
        <RiskLedger roster={roster} onSelect={(p) => setSelected(p)} />
      </div>

      <div className="grid-1-1">
        <WellnessWeek data={SAMPLE_WELLNESS_WEEK} />
        <MatchesRibbon matches={matches} />
      </div>

      <Marginalia dash={dash} />
    </div>
  );
}