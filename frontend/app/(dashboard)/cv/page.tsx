"use client";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import {
  UploadCloud, Film, Clock, CheckCircle2, XCircle,
  Loader2, AlertTriangle, Trash2, ArrowRight,
} from "lucide-react";
import { cvApi } from "@/lib/api";
import { useRealtime } from "@/lib/ws";
import { PageTitle, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

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
  pending:    { color: "var(--ink-faint)",  label: "en cola",    icon: Clock },
  processing: { color: "var(--slate)",      label: "procesando", icon: Loader2 },
  done:       { color: "var(--pine)",       label: "listo",      icon: CheckCircle2 },
  failed:     { color: "var(--terracotta)", label: "falló",      icon: XCircle },
};
const STATUS_FALLBACK = { color: "var(--ink-faint)", label: "desconocido", icon: AlertTriangle };

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
    queryFn: cvApi.list,
    refetchInterval: 8_000,
  });

  useRealtime("cv", () => { qc.invalidateQueries({ queryKey: ["cv-list"] }); });

  const uploadMut = useMutation({
    mutationFn: (file: File) => cvApi.upload(file, { notes: notes || undefined }),
    onSuccess: () => {
      toast.success("Video subido. Procesamiento iniciado.");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["cv-list"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al subir el video"),
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
    if (!f.type.startsWith("video/")) { toast.error("Solo se permiten archivos de video"); return; }
    if (f.size > 500 * 1024 * 1024) { toast.error("El video supera 500 MB. Comprime antes de subir."); return; }
    uploadMut.mutate(f);
  };

  return (
    <div className="screen">
      <PageTitle title="Análisis de video" subtitle="sube un partido y deja que la IA lea las jugadas" />

      <Card kicker="Sube un clip · MP4 · MOV · AVI · máx 500 MB" title="Nuevo análisis">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
          style={{
            borderRadius: "var(--radius)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", padding: "42px 24px", cursor: "pointer", transition: "all .15s",
            background: dragOver ? "rgba(193,102,74,0.06)" : "var(--paper)",
            border: `2px dashed ${dragOver ? "var(--terracotta)" : "var(--rule)"}`,
          }}
        >
          <input ref={fileInput} type="file" accept="video/*" onChange={onPick} hidden />
          <div style={{ position: "relative", width: 56, height: 56, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }}>
              <circle cx="28" cy="28" r="22" fill="none" stroke="var(--terracotta)" strokeWidth="2" strokeDasharray="3 5" filter="url(#wobble)" />
            </svg>
            {uploadMut.isPending
              ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--terracotta)" }} />
              : <UploadCloud className="w-6 h-6" style={{ color: "var(--terracotta)" }} />}
          </div>
          <p style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 18, color: "var(--ink)" }}>
            {uploadMut.isPending ? "Subiendo video…" : "Arrastra tu video aquí"}
          </p>
          <Note style={{ fontSize: 15, marginTop: 4 }}>o haz click para seleccionarlo</Note>
        </div>

        <div style={{ marginTop: 14 }}>
          <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Notas (opcional)</Note>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="P.ej. Segundo tiempo vs Atlético, 2do gol nuestro"
            className="input"
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--ochre)" }} />
          <Note style={{ fontSize: 14.5, opacity: 0.85 }}>
            El procesamiento puede tardar 1–3× la duración del clip. El pipeline detecta jugadores (YOLO),
            asigna equipos por color de camiseta (K-means) y calcula velocidades/distancias.
          </Note>
        </div>
      </Card>

      <Card kicker="Historial del análisis de video" title="Análisis recientes"
        note={list.length ? `${list.length} en total` : undefined}>
        {isLoading ? (
          <Note style={{ fontSize: 17, opacity: 0.7, display: "block", padding: "16px 4px" }}>cargando análisis…</Note>
        ) : list.length === 0 ? (
          <div className="coming" style={{ padding: "32px 0" }}>
            <svg width="96" height="96" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="34" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="3 5" filter="url(#wobble)" />
              <circle cx="60" cy="60" r="10" fill="var(--terracotta)" filter="url(#wobble)" />
            </svg>
            <Note style={{ fontSize: 18, marginTop: 8 }}>Sin análisis aún.<br />Sube tu primer video.</Note>
          </div>
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence initial={false}>
              {list.map((row) => {
                const meta = STATUS_META[row.status] ?? STATUS_FALLBACK;
                const Icon = meta.icon;
                return (
                  <motion.li
                    key={row.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -8 }}
                    style={{
                      borderRadius: "var(--radius)", padding: 12, display: "flex", alignItems: "center", gap: 14,
                      background: "var(--paper)", border: "1.5px solid var(--rule)",
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--paper-card)", border: `1.5px solid ${meta.color}`, color: meta.color, flexShrink: 0 }}>
                      <Icon className={"w-5 h-5" + (row.status === "processing" ? " animate-spin" : "")} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 16.5, color: "var(--ink)" }}>
                          <Film className="w-3.5 h-3.5 inline-block mr-1.5 -translate-y-0.5" style={{ color: meta.color }} />
                          {row.name}
                        </span>
                        <span style={{ fontFamily: "var(--hand)", fontSize: 14, color: meta.color }}>· {meta.label}</span>
                      </div>
                      <Note style={{ fontSize: 14, display: "block", marginTop: 2 }}>
                        {durationHuman(row.duration_s)}
                        {row.frame_count != null && ` · ${row.frame_count.toLocaleString()} frames`}
                        {row.fps != null && ` · ${row.fps.toFixed(1)} fps`}
                        {" · "}{new Date(row.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                      </Note>
                      {row.notes && <Note style={{ fontSize: 14, display: "block", marginTop: 2, opacity: 0.85 }}>{row.notes}</Note>}
                      {row.status === "processing" && (
                        <div style={{ marginTop: 8, height: 4, borderRadius: 999, overflow: "hidden", background: "var(--rule)" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(row.progress ?? 0) * 100}%` }}
                            transition={{ duration: 0.4 }} style={{ height: "100%", background: "var(--slate)" }} />
                        </div>
                      )}
                      {row.status === "failed" && row.error && (
                        <Note style={{ fontSize: 13.5, display: "block", marginTop: 4, color: "var(--terracotta)" }}>{row.error}</Note>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {row.status === "done" && (
                        <Link href={`/cv/${row.id}`} className="chip is-on">
                          Ver <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <button
                        onClick={() => { if (confirm(`¿Eliminar análisis "${row.name}"?`)) deleteMut.mutate(row.id); }}
                        className="theme-toggle" aria-label="Eliminar"
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
