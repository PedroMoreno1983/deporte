"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { playersApi, categoriesApi } from "@/lib/api";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Search, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { ExportButton } from "@/components/ui/ExportButton";
import { getPositionConfig, getStatusConfig } from "@/lib/design-system";

const STATUS_OPTS = [
  { value: "", label: "Todos" },
  { value: "available", label: "Disponible" },
  { value: "injured", label: "Lesionado" },
  { value: "recovering", label: "Recuperación" },
  { value: "suspended", label: "Suspendido" },
];

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [status, setStatus] = useState<string>("");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: players, isLoading } = useQuery({
    queryKey: ["players", categoryId, status, search],
    queryFn: () => playersApi.list({ category_id: categoryId, status: status || undefined, search: search || undefined }),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jugadores"
        subtitle={`${players?.length ?? 0} jugadores registrados`}
        action={
          <div className="flex items-center gap-2">
            <ExportButton
              filename="plantel"
              sheets={{
                Plantel: (players ?? []).map((p: any) => ({
                  Numero:      p.jersey_number ?? "",
                  Nombre:      p.first_name,
                  Apellido:    p.last_name,
                  Posicion:    getPositionConfig(p.position).label,
                  Estado:      getStatusConfig(p.status).label,
                  Pie:         p.dominant_foot ?? "",
                  Altura_cm:   p.height_cm ?? "",
                  Peso_kg:     p.weight_kg ?? "",
                  Nacionalidad: p.nationality ?? "",
                })),
              }}
            />
            <Link href="/players/new" className="btn-primary text-sm">
              <Plus className="w-4 h-4" />
              Nuevo jugador
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-0 sm:min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="input w-full pl-10 pr-8"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          className="input text-sm py-2"
        >
          <option value="">Todas las categorías</option>
          {categories?.map((c: { id: number; name: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                status === opt.value
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl h-40" style={{ animationDelay: `${i * 0.04}s` }} />
            ))}
          </motion.div>
        ) : players?.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 bg-white/[0.03] border border-white/[0.06]">
              <Users className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-base font-semibold text-white/50">No se encontraron jugadores</p>
            <p className="text-sm text-white/30 mt-1">Prueba con otros filtros o busca por nombre</p>
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {players?.map((player: any, i: number) => (
              <PlayerCard
                key={player.id}
                id={player.id}
                firstName={player.first_name}
                lastName={player.last_name}
                jerseyNumber={player.jersey_number}
                position={player.position}
                status={player.status}
                photoUrl={player.photo_url}
                index={i}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
