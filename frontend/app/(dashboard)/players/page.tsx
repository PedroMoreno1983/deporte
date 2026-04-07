"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { playersApi, categoriesApi } from "@/lib/api";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Search, Plus, Users, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

const STATUS_OPTS = [
  { value: "", label: "Todos los estados" },
  { value: "available", label: "Disponible" },
  { value: "injured", label: "Lesionado" },
  { value: "recovering", label: "Recuperación" },
  { value: "suspended", label: "Suspendido" },
];

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [status, setStatus] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: players, isLoading } = useQuery({
    queryKey: ["players", categoryId, status, search],
    queryFn: () => playersApi.list({ category_id: categoryId, status: status || undefined, search: search || undefined }),
  });

  const activeFilters = [categoryId, status].filter(Boolean).length;

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <PageHeader
        icon={Users}
        title="Jugadores"
        description={`${players?.length ?? 0} jugadores registrados`}
        badge={players?.length ? String(players.length) : undefined}
        className="pl-12 lg:pl-0"
        action={
          <Link href="/players/new">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "var(--neon)",
                color: "#000",
                boxShadow: "0 0 20px rgba(0,255,135,0.35)",
              }}
            >
              <Plus className="w-4 h-4" />
              Nuevo jugador
            </motion.button>
          </Link>
        }
      />

      {/* Search + filters bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(0,255,135,0.4)";
              e.target.style.boxShadow = "0 0 0 3px rgba(0,255,135,0.08)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-subtle)";
              e.target.style.boxShadow = "none";
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-2.5 text-sm rounded-xl outline-none transition-all duration-200 cursor-pointer"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
          }}
        >
          <option value="">Todas las categorías</option>
          {categories?.map((c: { id: number; name: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
              style={status === opt.value ? {
                background: "rgba(0,255,135,0.15)",
                border: "1px solid rgba(0,255,135,0.35)",
                color: "var(--neon)",
              } : {
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="skeleton rounded-2xl"
                style={{ height: 168, animationDelay: `${i * 0.04}s` }}
              />
            ))}
          </motion.div>
        ) : players?.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}
            >
              <Users className="w-8 h-8" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
            </div>
            <p className="text-base font-semibold" style={{ color: "var(--text-secondary)" }}>
              No se encontraron jugadores
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Prueba con otros filtros o busca por nombre
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {players?.map((player: {
              id: number; first_name: string; last_name: string; jersey_number?: number;
              position: string; status: string; photo_url?: string;
            }, i: number) => (
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
