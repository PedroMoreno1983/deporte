"use client";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import {
  Video, UploadCloud, Film, Clock, CheckCircle2, XCircle,
  Loader2, AlertTriangle, Trash2, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cvApi } from "@/lib/api";
import { useRealtime } from "@/lib/ws";

type CVStatus = "pending" | "processing" | "done" | "failed";

interface AnalysisRow {
  id: number;
  name: string;
  status: CVStatus;
  progress: number;
  duration_s: number | null;
  frame_count: number | null;
  fps: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  notes: string | null;
  results: any | null;
}

const STATUS_META: Record<CVStatus, { color: string; label: string; icon: any }> = {
  pending:    { color: "#94a3b8", label: "En cola",      icon: Clock },
  processing: { color: "#0ea5e9", label: "Procesando",   icon: Loader2 },
  done:       { color: "#00ff87", label: "Listo",        icon: CheckCircle2 },
  failed:     { color: "#ff3b30", label: "Falló",        icon: XCircle },
};

// Defensive fallback: an unrecognised status (e.g. a future enum value) must
// degrade gracefully — never crash the whole list with `undefined.icon`.
const STATUS_FALLBACK = { color: "#94a3b8", label: "Desconocido", icon: AlertTriangle };

function bytesHuman(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function durationHuman(s: number | null) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function CVPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: list = [], isLoading } = useQuery<AnalysisRow[]>({
    queryKey: ["cv-list"],
    queryFn:  cvApi.list,
    refetchInterval: 8_000, // safety net on top of WS
  });

  // Real-time progress
  useRealtime("cv", () => {
    qc.invalidateQueries({ queryKey: ["cv-list"] });
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => cvApi.upload(file, { notes: notes || undefined }),
    onSuccess: () => {
      toast.success("Video subido. Procesamiento iniciado.");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["cv-list"] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.detail || "Error al subir el video";
      toast.error(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => cvApi.remove(id),
    onSuccess: () => {
      toast.success("Análisis eliminado");
      qc.invalidateQueries({ queryKey: ["cv-list"] });
    },
  });

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleFile = (f: File) => {
    if (!f.type.startsWith("video/")) {
      toast.error("Solo se permiten archivos de video");
      return;
    }
    const max = 500 * 1024 * 1024; // 500 MB
    if (f.size > max) {
      toast.error("El video supera 500 MB. Comprime antes de subir.");
      return;
    }
    uploadMut.mutate(f);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        icon={Video}
        title="Análisis de video"
        description="Sube un partido y deja que la IA detecte jugadores, equipos, velocidades y posiciones."
        iconColor="text-[#00ff87]"
        iconBg="bg-[rgba(0,255,135,0.10)] border-[rgba(0,255,135,0.30)]"
      />

      {/* ── Uploader ──────────────────────────────────────── */}
      <Card>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
          className="relative rounded-xl flex flex-col items-center justify-center text-center px-6 py-12 cursor-pointer transition-all"
          style={{
            background: dragOver ? "rgba(0,255,135,0.06)" : "rgba(255,255,255,0.02)",
            border: `2px dashed ${dragOver ? "rgba(0,255,135,0.55)" : "rgba(255,255,255,0.10)"}`,
          }}
        >
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            onChange={onPick}
            hidden
          />
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(0,255,135,0.18) 0%, rgba(0,255,135,0.06) 100%)",
              border: "1px solid rgba(0,255,135,0.32)",
              boxShadow: "0 0 24px rgba(0,255,135,0.20)",
            }}
          >
            {uploadMut.isPending ? (
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#00ff87" }} />
            ) : (
              <UploadCloud className="w-7 h-7" style={{ color: "#00ff87" }} />
            )}
          </div>
          <p className="text-base font-bold text-white">
            {uploadMut.isPending ? "Subiendo video..." : "Arrastra tu video aquí"}
          </p>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            o haz click para seleccionarlo · MP4 · MOV · AVI · máx 500 MB
          </p>
        </div>

        {/* Notes input */}
        <div className="mt-4">
          <label
            className="block text-[10px] font-bold tracking-[0.18em] uppercase mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Notas (opcional)
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="P.ej. Segundo tiempo vs Atlético, 2do gol nuestro"
            className="input w-full"
          />
        </div>

        <div className="mt-3 flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            El procesamiento puede tardar 1-3× la duración del clip. El pipeline detecta jugadores con
            YOLO, asigna equipos por color de camiseta con K-means, y calcula velocidades/distancias.
          </span>
        </div>
      </Card>

      {/* ── List ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            Análisis recientes
          </p>
          {list.length > 0 && (
            <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
              {list.length} total
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            illustration="data"
            title="Sin análisis aún"
            description="Sube tu primer video para que la plataforma procese las jugadas."
            size="compact"
          />
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {list.map((row, i) => {
                const meta = STATUS_META[row.status] ?? STATUS_FALLBACK;
                const Icon = meta.icon;
                return (
                  <motion.li
                    key={row.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-xl p-3 flex items-center gap-4 relative"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${meta.color}24`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: `${meta.color}14`,
                        border: `1px solid ${meta.color}30`,
                        color: meta.color,
                      }}
                    >
                      <Icon
                        className={`w-5 h-5 ${row.status === "processing" ? "animate-spin" : ""}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white/85 truncate">
                          <Film className="w-3 h-3 inline-block mr-1.5 -translate-y-0.5" style={{ color: meta.color }} />
                          {row.name}
                        </p>
                        <span
                          className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: `${meta.color}18`,
                            color: meta.color,
                            border: `1px solid ${meta.color}40`,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[11px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                        <span>{durationHuman(row.duration_s)}</span>
                        {row.frame_count != null && <span>{row.frame_count.toLocaleString()} frames</span>}
                        {row.fps != null && <span>{row.fps.toFixed(1)} fps</span>}
                        <span className="opacity-60">·</span>
                        <span>{new Date(row.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>

                      {row.notes && (
                        <p className="text-xs mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                          {row.notes}
                        </p>
                      )}

                      {/* Progress bar while processing */}
                      {row.status === "processing" && (
                        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(row.progress ?? 0) * 100}%` }}
                            transition={{ duration: 0.4 }}
                            style={{ background: "#0ea5e9", boxShadow: "0 0 6px rgba(14,165,233,0.5)" }}
                          />
                        </div>
                      )}

                      {row.status === "failed" && row.error && (
                        <p className="text-[11px] mt-1.5" style={{ color: "var(--color-danger)" }}>
                          {row.error}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {row.status === "done" && (
                        <Link
                          href={`/cv/${row.id}`}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 transition-all"
                          style={{
                            background: "rgba(0,255,135,0.10)",
                            color: "#00ff87",
                            border: "1px solid rgba(0,255,135,0.30)",
                          }}
                        >
                          Ver
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar análisis "${row.name}"?`)) {
                            deleteMut.mutate(row.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-white/30 hover:text-[var(--color-danger)] transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Card>
    </div>
  );
}
