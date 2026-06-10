"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { playersApi, categoriesApi, predictionsApi } from "@/lib/api";
import { adaptRoster } from "@/lib/lupi-adapters";
import {
  type LupiPlayer, type LupiPos,
  POS_COLOR, POS_LABEL, STATUS_COLOR, STATUS_LABEL, RISK_COLOR,
} from "@/lib/lupi";
import { PageTitle, PlayerPeekFull } from "@/components/lupi/viz";
import { PlayerGlyph, Note } from "@/components/lupi/primitives";
import { ExportButton } from "@/components/ui/ExportButton";
import { getPositionConfig, getStatusConfig } from "@/lib/design-system";

const POS_FILTERS: [LupiPos | "ALL", string][] = [
  ["ALL", "Todos"],
  ["GK", "Arqueros"],
  ["DEF", "Defensas"],
  ["MID", "Medios"],
  ["ATK", "Delanteros"],
];

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [pos, setPos] = useState<LupiPos | "ALL">("ALL");
  const [sel, setSel] = useState<LupiPlayer | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: players, isLoading } = useQuery({
    queryKey: ["players", categoryId, search],
    queryFn: () => playersApi.list({ category_id: categoryId, search: search || undefined }),
  });

  const { data: teamRisk } = useQuery({ queryKey: ["team-risk"], queryFn: () => predictionsApi.teamRisk() });

  const roster = adaptRoster(players, teamRisk);
  const filtered = pos === "ALL" ? roster : roster.filter((p) => p.pos === pos);

  return (
    <div className="screen">
      <PageTitle title="Jugadores" subtitle="cada ficha es una persona, no una fila de tabla">
        <div className="flex items-center gap-2">
          <ExportButton
            filename="plantel"
            sheets={{
              Plantel: (players ?? []).map((p: any) => ({
                Numero:       p.jersey_number ?? "",
                Nombre:       p.first_name,
                Apellido:     p.last_name,
                Posicion:     getPositionConfig(p.position).label,
                Estado:       getStatusConfig(p.status).label,
                Pie:          p.dominant_foot ?? "",
                Altura_cm:    p.height_cm ?? "",
                Peso_kg:      p.weight_kg ?? "",
                Nacionalidad: p.nationality ?? "",
              })),
            }}
          />
          <Link href="/players/new" className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Nuevo jugador
          </Link>
        </div>
      </PageTitle>

      <div className="filter-bar">
        {POS_FILTERS.map(([k, label]) => (
          <button key={k} className={"chip" + (pos === k ? " is-on" : "")} onClick={() => setPos(k)}>
            {k !== "ALL" && <span className="chip-dot" style={{ background: POS_COLOR[k as LupiPos] }} />}
            {label}
          </button>
        ))}

        <div className="lupi-search">
          <Search className="w-3.5 h-3.5" style={{ color: "var(--ink-faint)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador…"
            aria-label="Buscar jugador"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          className="lupi-select"
        >
          <option value="">Todas las categorías</option>
          {categories?.map((c: { id: number; name: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <Note style={{ fontSize: 15, marginLeft: "auto", opacity: 0.75 }}>{filtered.length} jugadores</Note>
      </div>

      {isLoading ? (
        <Note style={{ fontSize: 17, opacity: 0.7, display: "block", padding: "32px 4px" }}>
          leyendo el cuaderno del plantel…
        </Note>
      ) : filtered.length === 0 ? (
        <div className="coming" style={{ padding: "48px 0" }}>
          <svg width="96" height="96" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="34" fill="none" stroke="var(--ink-faint)" strokeWidth="2"
              strokeDasharray="3 5" filter="url(#wobble)" />
            <circle cx="60" cy="60" r="10" fill="var(--ochre)" filter="url(#wobble)" />
          </svg>
          <Note style={{ fontSize: 18, marginTop: 8 }}>
            No hay jugadores con estos filtros.<br />Prueba con otra posición o nombre.
          </Note>
        </div>
      ) : (
        <div className="players-grid">
          {filtered.map((p) => (
            <button
              key={p.id}
              className={"player-card" + (sel?.id === p.id ? " is-sel" : "")}
              onClick={() => setSel(sel?.id === p.id ? null : p)}
            >
              <PlayerGlyph p={p} box={56} />
              <div className="player-card-body">
                <div className="player-card-name">{p.name}</div>
                <Note style={{ fontSize: 14 }}>{POS_LABEL[p.pos]} · {p.age || "—"}</Note>
                <div className="player-card-stats">
                  <span>{p.minutes.toLocaleString("es")}′</span>
                  <span className="pc-dot" />
                  <span style={{ color: STATUS_COLOR[p.status] }}>{STATUS_LABEL[p.status]}</span>
                </div>
              </div>
              {p.risk >= 12 && (
                <span className="player-card-risk" style={{ color: RISK_COLOR[p.riskLevel] }}>{p.risk}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {sel && (
        <div className="drawer" onClick={() => setSel(null)}>
          <div className="drawer-card" onClick={(e) => e.stopPropagation()}>
            <PlayerPeekFull p={sel} onClose={() => setSel(null)} />
            <Link href={`/players/${sel.id}`} className="btn-primary text-sm" style={{ marginTop: 16 }}>
              Ver ficha completa
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
