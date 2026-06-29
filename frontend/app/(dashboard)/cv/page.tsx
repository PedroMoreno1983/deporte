"use client";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import {
  UploadCloud, Film, Clock, CheckCircle2, XCircle,
  Loader2, AlertTriangle, Trash2, ArrowRight, X, Cpu, Server, Gauge,
} from "lucide-react";
import { cvApi, matchesApi, categoriesApi, type CVDiagnostics } from "@/lib/api";
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

function StatusPill({ label, value, tone = "var(--ink)" }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <Note style={{ fontSize: 12.5, display: "block", marginBottom: 2 }}>{label}</Note>
      <div style={{ fontFamily: "var(--serif)", fontWeight: 650, fontSize: 16, color: tone, overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  );
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

  const [matchId, setMatchId] = useState<number | null>(null);
  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [quickOpponent, setQuickOpponent] = useState("");
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split("T")[0]);
  const [quickCategory, setQuickCategory] = useState<number | null>(null);
  const [quickIsHome, setQuickIsHome] = useState(true);

  const { data: matches = [], refetch: refetchMatches } = useQuery<any[]>({
    queryKey: ["matches-list"],
    queryFn: () => matchesApi.list()
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories-list"],
    queryFn: categoriesApi.list
  });
  const { data: diagnostics } = useQuery<CVDiagnostics>({
    queryKey: ["cv-diagnostics"],
    queryFn: cvApi.diagnostics,
    refetchInterval: 30_000,
  });

  const handleCreateQuickMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickOpponent || !quickCategory) {
      toast.error("Por favor completa el rival y la categoría");
      return;
    }
    try {
      const newMatch = await matchesApi.create({
        date: quickDate,
        opponent: quickOpponent,
        category_id: Number(quickCategory),
        is_home: quickIsHome,
        goals_for: null,
        goals_against: null,
      });
      toast.success(`Partido vs ${quickOpponent} creado.`);
      await refetchMatches();
      setMatchId(newMatch.id);
      setShowQuickMatch(false);
      setQuickOpponent("");
    } catch (err) {
      toast.error("Error al crear el partido");
    }
  };

  const queueRef = useRef<File[]>([]);
  const [queueLength, setQueueLength] = useState(0);
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  const uploadNext = async () => {
    if (queueRef.current.length === 0) {
      setUploadingName(null);
      return;
    }
    const nextFile = queueRef.current[0];
    setUploadingName(nextFile.name);
    queueRef.current = queueRef.current.slice(1);
    setQueueLength(queueRef.current.length);
    
    try {
      await cvApi.upload(nextFile, { match_id: matchId || undefined, notes: notes || undefined });
      toast.success(`Video "${nextFile.name}" subido con éxito.`);
      qc.invalidateQueries({ queryKey: ["cv-list"] });
    } catch (e: any) {
      toast.error(`Error al subir "${nextFile.name}": ` + (e?.response?.data?.detail || "Error desconocido"));
    }
    
    uploadNext();
  };

  const handleFiles = (files: File[]) => {
    const validFiles: File[] = [];
    for (const f of files) {
      if (!f.type.startsWith("video/")) {
        toast.error(`"${f.name}" no es un archivo de video`);
        continue;
      }
      if (f.size > 500 * 1024 * 1024) {
        toast.error(`"${f.name}" supera los 500 MB y fue omitido`);
        continue;
      }
      validFiles.push(f);
    }
    
    if (validFiles.length === 0) return;
    
    const wasEmpty = queueRef.current.length === 0 && uploadingName === null;
    queueRef.current = [...queueRef.current, ...validFiles];
    setQueueLength(queueRef.current.length);
    
    if (wasEmpty) {
      uploadNext();
    }
  };

  const { data: list = [], isLoading } = useQuery<AnalysisRow[]>({
    queryKey: ["cv-list"],
    queryFn: () => cvApi.list() as Promise<AnalysisRow[]>,
    refetchInterval: 8_000,
  });

  useRealtime("cv", () => { qc.invalidateQueries({ queryKey: ["cv-list"] }); });

  const uploadMut = useMutation({
    mutationFn: (file: File) => cvApi.upload(file, { match_id: matchId || undefined, notes: notes || undefined }),
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
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
    e.target.value = "";
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  return (
    <div className="screen">
      <PageTitle title="Análisis de video" subtitle="sube clips de partido para extraer tracks, equipos y métricas físicas" />

      <Card kicker="Motor CV" title="Estado operativo">
        {diagnostics ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Cpu className="w-4 h-4 mt-1" style={{ color: diagnostics.model.is_finetuned ? "var(--pine)" : "var(--ochre)" }} />
                <StatusPill
                  label="Modelo"
                  value={diagnostics.model.is_finetuned ? "Fútbol entrenado" : "YOLO genérico"}
                  tone={diagnostics.model.is_finetuned ? "var(--pine)" : "var(--ochre)"}
                />
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Server className="w-4 h-4 mt-1" style={{ color: diagnostics.infrastructure.dispatch_mode === "celery-worker" ? "var(--pine)" : "var(--terracotta)" }} />
                <StatusPill
                  label="Ejecución"
                  value={diagnostics.infrastructure.dispatch_mode === "celery-worker" ? "Worker dedicado" : "Fallback API"}
                  tone={diagnostics.infrastructure.dispatch_mode === "celery-worker" ? "var(--pine)" : "var(--terracotta)"}
                />
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Gauge className="w-4 h-4 mt-1" style={{ color: "var(--slate)" }} />
                <StatusPill
                  label="Hostinger CPU"
                  value={`stride ${diagnostics.runtime.stride} · ${diagnostics.runtime.imgsz}px · OCR ${diagnostics.runtime.ocr_enabled ? "on" : "off"}`}
                  tone="var(--slate)"
                />
              </div>
            </div>
            <Note style={{ fontSize: 13.5, display: "block", overflowWrap: "anywhere" }}>
              Checkpoint: {diagnostics.model.path}. ffmpeg: {diagnostics.infrastructure.ffmpeg}. Video anotado: {diagnostics.runtime.video_enabled ? "on" : "off"}.
            </Note>
            {diagnostics.warnings.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {diagnostics.warnings.map((warning) => (
                  <div key={warning} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--ochre)" }} />
                    <Note style={{ fontSize: 14, color: "var(--ink)", opacity: 0.88 }}>{warning}</Note>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Note style={{ fontSize: 15 }}>Verificando motor de video...</Note>
        )}
      </Card>
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
          <input ref={fileInput} type="file" accept="video/*" onChange={onPick} multiple hidden />
          <div style={{ position: "relative", width: 56, height: 56, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }}>
              <circle cx="28" cy="28" r="22" fill="none" stroke="var(--terracotta)" strokeWidth="2" strokeDasharray="3 5" filter="url(#wobble)" />
            </svg>
            {uploadingName !== null
              ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--terracotta)" }} />
              : <UploadCloud className="w-6 h-6" style={{ color: "var(--terracotta)" }} />}
          </div>
          <p style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 18, color: "var(--ink)" }}>
            {uploadingName !== null ? `Subiendo "${uploadingName}"...` : "Arrastra tus videos aquí"}
          </p>
          <Note style={{ fontSize: 15, marginTop: 4 }}>
            {uploadingName !== null ? `Quedan ${queueLength} videos en cola` : "o haz click para seleccionar uno o varios videos"}
          </Note>
        </div>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <Note style={{ fontSize: 14, display: "block", marginBottom: 2 }}>Asociar a un Partido</Note>
          <select
            value={matchId || ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "new") {
                setShowQuickMatch(true);
                setMatchId(null);
              } else {
                setMatchId(v ? Number(v) : null);
              }
            }}
            className="input"
            style={{ width: "100%" }}
          >
            <option value="">-- Sin asociar a partido (Suelta) --</option>
            {matches.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.date} - vs {m.opponent} ({m.is_home ? "Local" : "Visita"})
              </option>
            ))}
            <option value="new" style={{ color: "var(--terracotta)", fontWeight: "bold" }}>
              [+ Crear nuevo partido...]
            </option>
          </select>
        </div>

        {showQuickMatch && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: "var(--radius)",
              border: "1.5px solid var(--rule)",
              background: "var(--paper-inset)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h4 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 15 }}>Nuevo Partido Rápido</h4>
              <button onClick={() => setShowQuickMatch(false)} className="theme-toggle">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateQuickMatch} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Fecha</label>
                  <input
                    type="date"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Rival</label>
                  <input
                    type="text"
                    placeholder="Ej. Colo Colo"
                    value={quickOpponent}
                    onChange={(e) => setQuickOpponent(e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Categoría</label>
                  <select
                    value={quickCategory || ""}
                    onChange={(e) => setQuickCategory(e.target.value ? Number(e.target.value) : null)}
                    className="input"
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Localía</label>
                  <select
                    value={quickIsHome ? "home" : "away"}
                    onChange={(e) => setQuickIsHome(e.target.value === "home")}
                    className="input"
                  >
                    <option value="home">Local</option>
                    <option value="away">Visita</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="chip is-on" style={{ alignSelf: "flex-end", marginTop: 4 }}>
                Crear Partido
              </button>
            </form>
          </div>
        )}

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
            En Hostinger CPU usa clips cortos. La precisión depende del checkpoint activo: con YOLO genérico detecta personas; con players.pt mejora lectura futbolística.
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
