"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search, X, Upload, AlertCircle } from "lucide-react";
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

  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<number | "">("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const queryClient = useQueryClient();

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    if (!selectedCatId) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await playersApi.importPlayers(importFile, Number(selectedCatId));
      setImportResult(res);
      queryClient.invalidateQueries({ queryKey: ["players"] });
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error desconocido al importar";
      alert(msg);
    } finally {
      setIsImporting(false);
    }
  };

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
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importar Excel/CSV
          </button>
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

      {showImportModal && (
        <div className="drawer" onClick={() => { if (!isImporting) setShowImportModal(false); }}>
          <div className="drawer-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Importar Plantel desde Excel/CSV</h3>
              <button 
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {!importResult ? (
              <form onSubmit={handleImport} className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold block mb-1 uppercase tracking-wider text-white/60">
                    1. Categoría de Destino
                  </label>
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value ? Number(e.target.value) : "")}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">Selecciona una categoría...</option>
                    {categories?.map((c: { id: number; name: string }) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold block mb-1 uppercase tracking-wider text-white/60">
                    2. Archivo (.xlsx, .csv)
                  </label>
                  <div 
                    className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors"
                    style={{
                      borderColor: importFile ? "rgba(0,255,135,0.40)" : "var(--border-subtle)",
                      background: importFile ? "rgba(0,255,135,0.04)" : "rgba(255,255,255,0.02)",
                    }}
                    onClick={() => document.getElementById("excel-file-input")?.click()}
                  >
                    <Upload className="w-8 h-8 mb-2" style={{ color: importFile ? "#00ff87" : "var(--text-secondary)" }} />
                    <span className="text-xs text-center text-white/80 font-medium">
                      {importFile ? importFile.name : "Haz clic para seleccionar o arrastra un archivo"}
                    </span>
                    <span className="text-[10px] text-center text-white/40 mt-1">
                      Columnas soportadas: Nombre, Apellido, Dorsal, Posición, Nacimiento, Perfil, Altura, Peso
                    </span>
                    <input
                      id="excel-file-input"
                      type="file"
                      accept=".xlsx,.xlsm,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImportFile(file);
                      }}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    disabled={isImporting}
                    className="btn-secondary text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting || !importFile || !selectedCatId}
                    className="btn-primary text-xs flex items-center gap-1.5"
                  >
                    {isImporting ? "Importando..." : "Importar"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl" style={{ background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.20)" }}>
                  <p className="text-sm font-bold text-white">¡Importación Completada!</p>
                  <p className="text-xs mt-1 text-white/70">
                    Se han importado <strong className="text-[#00ff87] font-black">{importResult.imported}</strong> jugadores exitosamente.
                  </p>
                  {importResult.skipped > 0 && (
                    <p className="text-xs text-white/60 mt-0.5">
                      Se omitieron {importResult.skipped} filas por falta de datos.
                    </p>
                  )}
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-yellow-500" /> Advertencias/Errores ({importResult.errors.length})
                    </p>
                    <div className="max-h-36 overflow-y-auto rounded-xl p-3 text-xs space-y-1 font-mono text-white/60" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
                      {importResult.errors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={() => {
                      setImportFile(null);
                      setImportResult(null);
                      setShowImportModal(false);
                    }}
                    className="btn-primary text-xs"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
