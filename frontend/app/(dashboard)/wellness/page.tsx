"use client";
import { useQuery } from "@tanstack/react-query";
import { playersApi, predictionsApi } from "@/lib/api";
import { adaptRoster } from "@/lib/lupi-adapters";
import { SAMPLE_WELLNESS_WEEK, deriveWellPlayers } from "@/lib/lupi-fallbacks";
import { PageTitle, Card, WellnessWeek, WellFlower } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

const MEASURES = [
  { key: "sleep", label: "sueño", color: "var(--slate)" },
  { key: "load", label: "carga", color: "var(--ochre)" },
  { key: "soreness", label: "dolor", color: "var(--terracotta)" },
  { key: "mood", label: "ánimo", color: "var(--pine)" },
];

export default function WellnessPage() {
  const { data: players } = useQuery({ queryKey: ["players"], queryFn: () => playersApi.list() });
  const { data: teamRisk } = useQuery({ queryKey: ["team-risk"], queryFn: () => predictionsApi.teamRisk() });

  const roster = adaptRoster(players, teamRisk);
  const wellPlayers = deriveWellPlayers(roster);
  const flagged = wellPlayers.filter((p) => p.soreness >= 4).length;

  return (
    <div className="screen">
      <PageTitle title="Bienestar" subtitle="cómo se sienten, no solo cómo rinden" />

      <WellnessWeek data={SAMPLE_WELLNESS_WEEK} />

      <Card
        kicker="Auto-reporte de hoy · una flor por jugador"
        title="Jugador por jugador"
        note={`${flagged} jugadores con dolor alto`}
      >
        {wellPlayers.length === 0 ? (
          <Note style={{ fontSize: 17, opacity: 0.7, display: "block", padding: "16px 4px" }}>
            sin reportes del plantel todavía…
          </Note>
        ) : (
          <>
            <div className="flower-grid">
              {wellPlayers.map((p) => {
                const parts = p.name.split(" ");
                return (
                  <div className="flower-card" key={p.id}>
                    <WellFlower p={p} size={66} />
                    <div className="flower-name">{parts[0]} {parts[1]?.[0] ? parts[1][0] + "." : ""}</div>
                  </div>
                );
              })}
            </div>
            <div className="flower-legend">
              {MEASURES.map((m) => (
                <div className="well-leg" key={m.key}><span className="tl-dot" style={{ background: m.color }} />{m.label}</div>
              ))}
              <Note style={{ fontSize: 15, marginLeft: "auto", opacity: 0.75 }}>pétalo más largo = mejor (o más dolor en rojo)</Note>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
