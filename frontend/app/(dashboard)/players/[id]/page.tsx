"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { playersApi, analyticsApi, predictionsApi, kinesiologyApi, injuriesApi, wellnessApi } from "@/lib/api";
import { PDFExportButton } from "@/components/pdf/PDFExportButton";
import { PlayerReportPDF } from "@/components/pdf/PlayerReportPDF";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { formatAge, getStatusConfig, getPositionConfig, getRiskConfig } from "@/lib/design-system";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { PitchHeatmap } from "@/components/tactical/PitchHeatmap";
import { RiskExplanation } from "@/components/ui/RiskExplanation";
import { PlayerBenchmarks } from "@/components/ui/PlayerBenchmarks";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import {
  Activity, AlertTriangle, Shield, TrendingUp, Dumbbell,
  Calendar, ArrowLeft, TrendingDown, Minus, Brain, Heart, Moon, Zap, Droplets, Edit2, ClipboardList,
  Plus, X, Loader2, Check
} from "lucide-react";
import Link from "next/link";

const TABS = ["Resumen", "Físico", "Rendimiento", "Lesiones", "Wellness", "Predicción"] as const;
type Tab = typeof TABS[number];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs bg-surface-2 border border-white/[0.08]">
      <p className="font-medium text-white/60 mb-0.5">{label}</p>
      <p className="font-bold text-emerald-400">{payload[0]?.value?.toFixed?.(1) ?? payload[0]?.value}</p>
    </div>
  );
};

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const playerId = Number(id);
  const [tab, setTab] = useState<Tab>("Resumen");

  const qc = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const { data: player, refetch: refetchPlayer } = useQuery({ queryKey: ["player", playerId], queryFn: () => playersApi.get(playerId) });
  const { data: summary } = useQuery({ queryKey: ["player-summary", playerId], queryFn: () => analyticsApi.playerSummary(playerId) });
  const { data: prediction } = useQuery({ queryKey: ["prediction", playerId], queryFn: () => predictionsApi.getForPlayer(playerId) });
  const { data: kinesiology } = useQuery({ queryKey: ["kinesiology", playerId], queryFn: () => kinesiologyApi.getByPlayer(playerId) });
  const { data: injuries } = useQuery({ queryKey: ["injuries-player", playerId], queryFn: () => injuriesApi.getByPlayer(playerId) });
  const [wellnessDays, setWellnessDays] = useState(30);
  const { data: wellnessHistory } = useQuery({ queryKey: ["wellness-player", playerId, wellnessDays], queryFn: () => wellnessApi.getByPlayer(playerId, wellnessDays) });
  const { data: playerRadar } = useQuery({ queryKey: ["player-radar", playerId], queryFn: () => analyticsApi.playerRadar(playerId) });
  const { data: benchmarks } = useQuery({ queryKey: ["player-benchmarks", playerId], queryFn: () => analyticsApi.playerBenchmarks(playerId) });

  // Injury form
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryForm, setInjuryForm] = useState({ injury_date: new Date().toISOString().split("T")[0], injury_type: "", body_zone: "knee_left", severity: "grade_1", mechanism: "non_contact", during_match: false, estimated_days_out: "", return_date_estimated: "", treatment: "", diagnosed_by: "", description: "", notes: "" });
  const [injuryErrors, setInjuryErrors] = useState<Record<string, string>>({});

  const validateInjury = () => {
    const e: Record<string, string> = {};
    if (!injuryForm.injury_type.trim()) e.injury_type = "El tipo de lesión es obligatorio";
    if (!injuryForm.injury_date) e.injury_date = "La fecha es obligatoria";
    setInjuryErrors(e);
    return Object.keys(e).length === 0;
  };

  const createInjuryMutation = useMutation({
    mutationFn: () => injuriesApi.create({ player_id: playerId, ...injuryForm, estimated_days_out: injuryForm.estimated_days_out ? Number(injuryForm.estimated_days_out) : null, return_date_estimated: injuryForm.return_date_estimated || null, treatment: injuryForm.treatment || null, diagnosed_by: injuryForm.diagnosed_by || null, description: injuryForm.description || null, notes: injuryForm.notes || null, during_match: injuryForm.during_match }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["injuries-player", playerId] });
      qc.invalidateQueries({ queryKey: ["player", playerId] });
      toast.success("Lesión registrada");
      setShowInjuryForm(false);
      setInjuryForm({ injury_date: new Date().toISOString().split("T")[0], injury_type: "", body_zone: "knee_left", severity: "grade_1", mechanism: "non_contact", during_match: false, estimated_days_out: "", return_date_estimated: "", treatment: "", diagnosed_by: "", description: "", notes: "" });
      setInjuryErrors({});
    },
    onError: () => toast.error("Error al registrar la lesión"),
  });

  // Wellness form
  const [showWellnessForm, setShowWellnessForm] = useState(false);
  const [wellnessForm, setWellnessForm] = useState({ entry_date: new Date().toISOString().split("T")[0], sleep_quality: 7, fatigue: 7, mood: 7, muscle_soreness: 7, stress: 7, rpe_post: "", notes: "" });
  const [wellnessErrors, setWellnessErrors] = useState<Record<string, string>>({});

  const validateWellness = () => {
    const e: Record<string, string> = {};
    if (!wellnessForm.entry_date) e.entry_date = "La fecha es obligatoria";
    setWellnessErrors(e);
    return Object.keys(e).length === 0;
  };

  const createWellnessMutation = useMutation({
    mutationFn: () => wellnessApi.create({ player_id: playerId, ...wellnessForm, rpe_post: wellnessForm.rpe_post ? Number(wellnessForm.rpe_post) : null, notes: wellnessForm.notes || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-player", playerId, wellnessDays] });
      toast.success("Registro wellness guardado");
      setShowWellnessForm(false);
      setWellnessForm({ entry_date: new Date().toISOString().split("T")[0], sleep_quality: 7, fatigue: 7, mood: 7, muscle_soreness: 7, stress: 7, rpe_post: "", notes: "" });
      setWellnessErrors({});
    },
    onError: () => toast.error("Error al guardar el registro"),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) { toast.error("La imagen no puede superar 1 MB"); return; }
    try {
      await playersApi.uploadPhoto(playerId, file);
      await refetchPlayer();
      qc.invalidateQueries({ queryKey: ["players"] });
      toast.success("Foto actualizada");
    } catch {
      toast.error("Error al subir la foto");
    }
  };

  if (!player) return (
    <div className="space-y-4">
      <div className="skeleton h-24 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
      <div className="skeleton h-64 rounded-2xl" style={{ animationDelay: "0.25s" }} />
    </div>
  );

  const posConfig = getPositionConfig(player.position);
  const statusConfig = getStatusConfig(player.status);
  const latestKinesio = kinesiology?.[0];
  const activeInjuries = injuries?.filter((inj: any) => !inj.is_recovered) ?? [];
  const allInjuries = injuries ?? [];

  const radarData = latestKinesio ? [
    { metric: "Fuerza",    value: latestKinesio.squat_1rm_kg ? Math.min((latestKinesio.squat_1rm_kg / 150) * 100, 100) : 0 },
    { metric: "Velocidad", value: latestKinesio.sprint_30m_sec ? Math.max(100 - (latestKinesio.sprint_30m_sec - 3.5) * 50, 0) : 0 },
    { metric: "Salto",     value: latestKinesio.cmj_height_cm ? Math.min((latestKinesio.cmj_height_cm / 60) * 100, 100) : 0 },
    { metric: "VO₂ Máx",  value: latestKinesio.vo2_max ? Math.min((latestKinesio.vo2_max / 65) * 100, 100) : 0 },
    { metric: "Flexibil.", value: latestKinesio.sit_and_reach_cm ? Math.min(((latestKinesio.sit_and_reach_cm + 20) / 60) * 100, 100) : 0 },
  ] : [];

  const forecastData = prediction?.performance_forecast_4w?.map((v: number, i: number) => ({ week: `Sem ${i + 1}`, value: v })) ?? [];

  const TrendIcon = prediction?.performance_trend === "improving" ? TrendingUp : prediction?.performance_trend === "declining" ? TrendingDown : Minus;
  const trendColor = prediction?.performance_trend === "improving" ? "#00ff87" : prediction?.performance_trend === "declining" ? "#ff3b30" : "#f59e0b";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-5">
        <button onClick={() => router.back()} className="mt-1 text-white/30 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative shrink-0 group">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold cursor-pointer overflow-hidden border-2"
                style={{ borderColor: posConfig.color, color: posConfig.color, background: `${posConfig.color}10` }}
                onClick={() => photoRef.current?.click()}
              >
                {player.photo_url ? (
                  <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
                ) : `${player.first_name.charAt(0)}${player.last_name.charAt(0)}`}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{player.first_name} {player.last_name}</h1>
                <Badge variant="status" value={player.status} />
              </div>
              <p className="text-sm text-white/50 mt-0.5">
                {posConfig.label} {player.jersey_number ? `· #${player.jersey_number}` : ""}
                {player.category ? ` · ${player.category.name}` : ""}
                {player.date_of_birth ? ` · ${formatAge(player.date_of_birth)} años` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/players/${playerId}/kinesiology/new`} className="btn-secondary text-xs py-2 px-3">
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Evaluación</span>
          </Link>
          <Link href={`/players/${playerId}/edit`} className="btn-secondary text-xs py-2 px-3">
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Editar</span>
          </Link>
          <PDFExportButton
            document={
              <PlayerReportPDF
                player={player}
                summary={summary}
                prediction={prediction}
                kinesiology={kinesiology ?? []}
                injuries={injuries ?? []}
                wellness={wellnessHistory ?? []}
              />
            }
            fileName={`reporte-${player?.first_name?.toLowerCase()}-${player?.last_name?.toLowerCase()}.pdf`}
            label="PDF"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              tab === t ? "border-emerald-500 text-emerald-400" : "border-transparent text-white/30 hover:text-white/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-5">
        {tab === "Resumen" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Partidos", value: summary?.matches ?? 0 },
                { label: "Goles + Asist.", value: summary?.goal_contributions ?? 0 },
                { label: "Rating prom.", value: summary?.avg_rating?.toFixed(1) ?? "—", raw: true },
                { label: "Carga semanal", value: summary?.weekly_load ?? 0 },
                { label: "Lesiones", value: summary?.total_injuries ?? 0 },
              ].map(({ label, value, raw }) => (
                <Card key={label} className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">{raw ? value : Number(value)}</p>
                  <p className="text-xs text-white/30 mt-1">{label}</p>
                </Card>
              ))}
            </div>

            {activeInjuries.length > 0 && (
              <Card variant="danger" padding="md">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-bold text-red-400">Lesiones activas — {activeInjuries.length} en curso</h3>
                </div>
                <div className="space-y-2">
                  {activeInjuries.map((inj: any) => (
                    <div key={inj.id} className="flex items-center justify-between text-sm px-4 py-2.5 rounded-lg bg-red-500/[0.04] border border-red-500/10">
                      <div>
                        <span className="font-semibold text-white/80">{inj.injury_type}</span>
                        <span className="text-xs text-white/30 ml-2">· {inj.body_zone.replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-right text-xs text-white/30">
                        {inj.injury_date}
                        {inj.estimated_days_out && <span className="ml-2 font-semibold text-red-400">{inj.estimated_days_out}d est.</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {radarData.length > 0 && (
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Perfil físico</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <Radar dataKey="value" stroke={posConfig.color} fill={posConfig.color} fillOpacity={0.15} strokeWidth={2} dot={{ fill: posConfig.color, r: 3, strokeWidth: 0 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {forecastData.length > 0 && (
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Proyección 4 semanas</p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: trendColor, background: `${trendColor}15` }}>
                      <TrendIcon className="w-3 h-3" />
                      {prediction?.performance_trend === "improving" ? "Mejorando" : prediction?.performance_trend === "declining" ? "Bajando" : "Estable"}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="value" stroke={posConfig.color} strokeWidth={2} dot={{ fill: posConfig.color, r: 3, strokeWidth: 0 }} strokeDasharray="6 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          </motion.div>
        )}

        {tab === "Físico" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {latestKinesio ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Squat 1RM", value: latestKinesio.squat_1rm_kg ? `${latestKinesio.squat_1rm_kg} kg` : "—" },
                    { label: "Sprint 30m", value: latestKinesio.sprint_30m_sec ? `${latestKinesio.sprint_30m_sec}s` : "—" },
                    { label: "CMJ Height", value: latestKinesio.cmj_height_cm ? `${latestKinesio.cmj_height_cm} cm` : "—" },
                    { label: "VO₂ Máx", value: latestKinesio.vo2_max ? `${latestKinesio.vo2_max}` : "—" },
                    { label: "Sit & Reach", value: latestKinesio.sit_and_reach_cm ? `${latestKinesio.sit_and_reach_cm} cm` : "—" },
                    { label: "% Grasa corporal", value: latestKinesio.body_fat_percentage ? `${latestKinesio.body_fat_percentage}%` : "—" },
                    { label: "Masa muscular", value: latestKinesio.muscle_mass_kg ? `${latestKinesio.muscle_mass_kg} kg` : "—" },
                    { label: "Peso", value: latestKinesio.weight_kg ? `${latestKinesio.weight_kg} kg` : "—" },
                  ].map(({ label, value }) => (
                    <Card key={label} className="p-4">
                      <p className="text-xs text-white/30 mb-1">{label}</p>
                      <p className="text-xl font-bold" style={{ color: posConfig.color }}>{value}</p>
                    </Card>
                  ))}
                </div>

                {radarData.length > 0 && (
                  <Card>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Radar de capacidades</p>
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.06)" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                        <Radar dataKey="value" stroke={posConfig.color} fill={posConfig.color} fillOpacity={0.15} strokeWidth={2.5} dot={{ fill: posConfig.color, r: 4, strokeWidth: 0 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {(kinesiology?.length ?? 0) > 1 && (() => {
                  const sorted = [...(kinesiology ?? [])].sort((a: any, b: any) => new Date(a.evaluation_date).getTime() - new Date(b.evaluation_date).getTime());
                  const metricSeries = [
                    { key: "squat_1rm_kg", label: "Squat 1RM (kg)", color: "#f97316" },
                    { key: "cmj_height_cm", label: "CMJ (cm)", color: posConfig.color },
                    { key: "sprint_30m_sec", label: "Sprint 30m (s)", color: "#0ea5e9" },
                    { key: "vo2_max", label: "VO₂ máx", color: "#a855f7" },
                    { key: "body_fat_percentage", label: "% Grasa", color: "#ff3b30" },
                  ];
                  return (
                    <Card>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Evolución kinesiológica — {kinesiology?.length} evaluaciones</p>
                        <Link href={`/players/${playerId}/kinesiology/new`} className="btn-primary text-xs py-1.5 px-2.5">
                          <Plus className="w-3 h-3" /> Nueva
                        </Link>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[500px]">
                          <thead>
                            <tr className="border-b border-white/[0.06]">
                              {["Fecha", "Evaluador", "Squat 1RM", "CMJ", "Sprint 30m", "VO₂ máx", "% Grasa", "Peso"].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/30 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {sorted.slice().reverse().map((r: any, i: number) => (
                              <tr key={r.id ?? i} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-3 py-2.5 font-medium text-white/80">{r.evaluation_date}</td>
                                <td className="px-3 py-2.5 text-white/30">{r.evaluated_by ?? "—"}</td>
                                <td className="px-3 py-2.5 tabular-nums text-orange-400">{r.squat_1rm_kg ? `${r.squat_1rm_kg} kg` : "—"}</td>
                                <td className="px-3 py-2.5 tabular-nums" style={{ color: posConfig.color }}>{r.cmj_height_cm ? `${r.cmj_height_cm} cm` : "—"}</td>
                                <td className="px-3 py-2.5 tabular-nums text-sky-400">{r.sprint_30m_sec ? `${r.sprint_30m_sec}s` : "—"}</td>
                                <td className="px-3 py-2.5 tabular-nums text-purple-400">{r.vo2_max ?? "—"}</td>
                                <td className="px-3 py-2.5 tabular-nums text-red-400">{r.body_fat_percentage ? `${r.body_fat_percentage}%` : "—"}</td>
                                <td className="px-3 py-2.5 tabular-nums text-white/50">{r.weight_kg ? `${r.weight_kg} kg` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  );
                })()}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-white/30">
                <Dumbbell className="w-10 h-10 mb-3 opacity-30" />
                <p>Sin registros kinesiológicos disponibles</p>
                <Link href={`/players/${playerId}/kinesiology/new`} className="btn-primary mt-4 text-sm">
                  <Plus className="w-3.5 h-3.5" /> Primera evaluación
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {tab === "Rendimiento" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Partidos jugados", value: summary?.matches ?? 0 },
                { label: "Goles", value: summary?.goals ?? 0 },
                { label: "Asistencias", value: summary?.assists ?? 0 },
                { label: "Rating promedio", value: summary?.avg_rating?.toFixed(1) ?? "—", raw: true },
              ].map(({ label, value, raw }) => (
                <Card key={label} className="p-4 text-center">
                  <p className="text-3xl font-bold text-white">{raw ? value : Number(value)}</p>
                  <p className="text-xs text-white/30 mt-1">{label}</p>
                </Card>
              ))}
            </div>

            {playerRadar && (
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">Radar vs promedio equipo</p>
                <p className="text-xs text-white/20 mb-4">Métricas normalizadas 0-100</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={[
                      { metric: "Rendimiento", jugador: playerRadar.player?.rendimiento ?? 0, equipo: playerRadar.team_avg?.rendimiento ?? 0 },
                      { metric: "Goles", jugador: playerRadar.player?.goles ?? 0, equipo: playerRadar.team_avg?.goles ?? 0 },
                      { metric: "Asistencias", jugador: playerRadar.player?.asistencias ?? 0, equipo: playerRadar.team_avg?.asistencias ?? 0 },
                      { metric: "Minutos", jugador: playerRadar.player?.minutos ?? 0, equipo: playerRadar.team_avg?.minutos ?? 0 },
                      { metric: "Carga", jugador: playerRadar.player?.carga ?? 0, equipo: playerRadar.team_avg?.carga ?? 0 },
                    ]}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <Radar name="Jugador" dataKey="jugador" stroke={posConfig.color} fill={posConfig.color} fillOpacity={0.2} strokeWidth={2} dot={{ fill: posConfig.color, r: 3, strokeWidth: 0 }} />
                      <Radar name="Equipo" dataKey="equipo" stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.04)" strokeWidth={1.5} strokeDasharray="4 2" />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 self-center">
                    {["rendimiento","goles","asistencias","minutos","carga"].map((key) => {
                      const val = playerRadar.player?.[key] ?? 0;
                      const avg = playerRadar.team_avg?.[key] ?? 0;
                      const above = val >= avg;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="capitalize text-white/50">{key}</span>
                            <span className={`font-bold ${above ? "text-emerald-400" : "text-orange-400"}`}>
                              {val.toFixed(0)} <span className="text-white/20 font-normal">/ prom {avg.toFixed(0)}</span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.7, delay: 0.2 }} className="h-full rounded-full" style={{ background: above ? "#00ff87" : "#f97316" }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-4 mt-3 text-xs text-white/20">
                      <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: posConfig.color }} /> Jugador</div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded bg-white/30" /> Promedio</div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Benchmarks vs peers */}
            <Card>
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Benchmarks vs liga</p>
                <p className="text-xs text-white/40 mt-0.5">Percentiles vs jugadores de la misma posición</p>
              </div>
              <PlayerBenchmarks data={benchmarks} />
            </Card>

            {/* Heatmap */}
            <Card>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Mapa de calor</p>
                  <p className="text-xs text-white/40 mt-0.5">Zonas de actividad — últimos partidos</p>
                </div>
              </div>
              <div className="flex justify-center">
                <PitchHeatmap playerPosition={player?.position} width={420} />
              </div>
            </Card>

            {forecastData.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Proyección de rendimiento (4 semanas)</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: trendColor, background: `${trendColor}15` }}>
                    <TrendIcon className="w-3 h-3" />
                    {prediction?.performance_trend === "improving" ? "Mejorando" : prediction?.performance_trend === "declining" ? "Bajando" : "Estable"}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke={posConfig.color} strokeWidth={2.5} dot={{ fill: posConfig.color, r: 4, strokeWidth: 0 }} strokeDasharray="6 3" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}
          </motion.div>
        )}

        {tab === "Lesiones" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowInjuryForm(v => !v)} className="btn-secondary text-xs border-red-500/20 text-red-400 hover:bg-red-500/10">
                <Plus className="w-3.5 h-3.5" /> Registrar lesión
              </button>
            </div>

            <AnimatePresence>
              {showInjuryForm && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Card className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold flex items-center gap-2 text-red-400"><AlertTriangle className="w-4 h-4" /> Nueva lesión</p>
                      <button onClick={() => { setShowInjuryForm(false); setInjuryErrors({}); }} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Fecha *</label>
                        <input type="date" value={injuryForm.injury_date} onChange={e => { setInjuryForm(f => ({ ...f, injury_date: e.target.value })); setInjuryErrors(er => ({ ...er, injury_date: "" })); }}
                          className={`input w-full ${injuryErrors.injury_date ? "border-red-500/50 bg-red-500/5" : ""}`} />
                        {injuryErrors.injury_date && <p className="text-[10px] mt-1 text-red-400">{injuryErrors.injury_date}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Tipo de lesión *</label>
                        <input type="text" placeholder="Ej: Rotura muscular, Esguince..." value={injuryForm.injury_type} onChange={e => { setInjuryForm(f => ({ ...f, injury_type: e.target.value })); setInjuryErrors(er => ({ ...er, injury_type: "" })); }}
                          className={`input w-full ${injuryErrors.injury_type ? "border-red-500/50 bg-red-500/5" : ""}`} />
                        {injuryErrors.injury_type && <p className="text-[10px] mt-1 text-red-400">{injuryErrors.injury_type}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Zona corporal</label>
                        <select value={injuryForm.body_zone} onChange={e => setInjuryForm(f => ({ ...f, body_zone: e.target.value }))} className="input w-full">
                          {[["head","Cabeza"],["neck","Cuello"],["shoulder_left","Hombro Izq."],["shoulder_right","Hombro Der."],["arm_left","Brazo Izq."],["arm_right","Brazo Der."],["wrist_left","Muñeca Izq."],["wrist_right","Muñeca Der."],["thorax","Tórax"],["lumbar","Lumbar"],["abdomen","Abdomen"],["hip_left","Cadera Izq."],["hip_right","Cadera Der."],["thigh_left","Muslo Izq."],["thigh_right","Muslo Der."],["knee_left","Rodilla Izq."],["knee_right","Rodilla Der."],["leg_left","Pierna Izq."],["leg_right","Pierna Der."],["ankle_left","Tobillo Izq."],["ankle_right","Tobillo Der."],["foot_left","Pie Izq."],["foot_right","Pie Der."]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Severidad</label>
                        <select value={injuryForm.severity} onChange={e => setInjuryForm(f => ({ ...f, severity: e.target.value }))} className="input w-full">
                          <option value="grade_1">Grado I — Leve</option>
                          <option value="grade_2">Grado II — Moderado</option>
                          <option value="grade_3">Grado III — Severo</option>
                          <option value="grade_4">Grado IV — Cirugía</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Mecanismo</label>
                        <select value={injuryForm.mechanism} onChange={e => setInjuryForm(f => ({ ...f, mechanism: e.target.value }))} className="input w-full">
                          <option value="contact">Contacto</option>
                          <option value="non_contact">Sin contacto</option>
                          <option value="overload">Sobrecarga</option>
                          <option value="reinjury">Recidiva</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">¿En partido?</label>
                        <select value={injuryForm.during_match ? "true" : "false"} onChange={e => setInjuryForm(f => ({ ...f, during_match: e.target.value === "true" }))} className="input w-full">
                          <option value="false">No</option>
                          <option value="true">Sí</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Días estimados</label><input type="number" min={0} value={injuryForm.estimated_days_out} onChange={e => setInjuryForm(f => ({ ...f, estimated_days_out: e.target.value }))} className="input w-full" /></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Fecha alta estimada</label><input type="date" value={injuryForm.return_date_estimated} onChange={e => setInjuryForm(f => ({ ...f, return_date_estimated: e.target.value }))} className="input w-full" /></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Diagnosticado por</label><input type="text" value={injuryForm.diagnosed_by} onChange={e => setInjuryForm(f => ({ ...f, diagnosed_by: e.target.value }))} className="input w-full" /></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Tratamiento</label><input type="text" value={injuryForm.treatment} onChange={e => setInjuryForm(f => ({ ...f, treatment: e.target.value }))} className="input w-full" /></div>
                    </div>
                    <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Observaciones</label><textarea rows={2} value={injuryForm.description} onChange={e => setInjuryForm(f => ({ ...f, description: e.target.value }))} className="input w-full resize-none" /></div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowInjuryForm(false); setInjuryErrors({}); }} className="px-4 py-2 rounded-lg text-sm text-white/30 hover:text-white transition-colors">Cancelar</button>
                      <button onClick={() => { if (validateInjury()) createInjuryMutation.mutate(); }} disabled={createInjuryMutation.isPending} className="btn-primary text-sm disabled:opacity-40">
                        {createInjuryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Registrar
                      </button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {allInjuries.length === 0 && !showInjuryForm ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/30">
                <Shield className="w-10 h-10 mb-3 text-emerald-400 opacity-30" />
                <p className="text-sm">Sin historial de lesiones</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allInjuries.map((inj: any, i: number) => {
                  const sevConfig = getRiskConfig(inj.severity === "grade_1" ? "low" : inj.severity === "grade_2" ? "medium" : inj.severity === "grade_3" ? "high" : "critical");
                  const isActive = !inj.is_recovered;
                  return (
                    <motion.div key={inj.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      className={`flex items-start gap-4 p-4 rounded-xl border ${isActive ? "bg-red-500/[0.03] border-red-500/10" : "bg-white/[0.02] border-white/[0.06]"}`}>
                      <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: isActive ? "#ff3b30" : "#475569" }} />
                        {i < allInjuries.length - 1 && <div className="w-px flex-1 min-h-4 bg-white/[0.06]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-white/90">{inj.injury_type}</p>
                          <span className="badge" style={{ background: `${sevConfig.color}15`, borderColor: `${sevConfig.color}30`, color: sevConfig.color }}>{inj.severity.replace("grade_", "Grado ")}</span>
                          {isActive && <span className="badge bg-red-500/10 border-red-500/20 text-red-400">Activa</span>}
                        </div>
                        <p className="text-xs text-white/30">{inj.body_zone.replace(/_/g, " ")} · {inj.injury_date}{inj.estimated_days_out && ` · ${inj.estimated_days_out}d est.`}{inj.return_date && ` · Alta: ${inj.return_date}`}</p>
                        {inj.treatment && <p className="text-xs text-white/50 mt-1">{inj.treatment}</p>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === "Wellness" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/30">Período:</p>
                {[7, 14, 30].map((d) => (
                  <button key={d} onClick={() => setWellnessDays(d)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${wellnessDays === d ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/50"}`}>
                    {d}d
                  </button>
                ))}
              </div>
              <button onClick={() => setShowWellnessForm(v => !v)} className="btn-secondary text-xs" style={{ color: posConfig.color, borderColor: `${posConfig.color}30` }}>
                <Plus className="w-3.5 h-3.5" /> Registrar wellness
              </button>
            </div>

            <AnimatePresence>
              {showWellnessForm && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Card className="space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold flex items-center gap-2" style={{ color: posConfig.color }}><Heart className="w-4 h-4" /> Nuevo registro wellness</p>
                      <button onClick={() => { setShowWellnessForm(false); setWellnessErrors({}); }} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Fecha *</label>
                        <input type="date" value={wellnessForm.entry_date} onChange={e => { setWellnessForm(f => ({ ...f, entry_date: e.target.value })); setWellnessErrors(er => ({ ...er, entry_date: "" })); }}
                          className={`input ${wellnessErrors.entry_date ? "border-red-500/50 bg-red-500/5" : ""}`} />
                        {wellnessErrors.entry_date && <p className="text-[10px] mt-1 text-red-400">{wellnessErrors.entry_date}</p>}
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">RPE post-entreno</label>
                        <input type="number" min={1} max={10} value={wellnessForm.rpe_post} onChange={e => setWellnessForm(f => ({ ...f, rpe_post: e.target.value }))} className="input w-24" />
                      </div>
                    </div>
                    {([
                      { k: "sleep_quality", label: "Calidad de sueño", icon: Moon, help: "1 = muy mal · 10 = excelente" },
                      { k: "fatigue", label: "Fatiga", icon: Zap, help: "1 = muy fatigado · 10 = sin fatiga" },
                      { k: "mood", label: "Estado de ánimo", icon: Heart, help: "1 = muy bajo · 10 = excelente" },
                      { k: "muscle_soreness", label: "Dolor muscular", icon: Dumbbell, help: "1 = mucho dolor · 10 = sin dolor" },
                      { k: "stress", label: "Estrés", icon: Activity, help: "1 = muy estresado · 10 = sin estrés" },
                    ] as const).map(({ k, label, icon: Icon, help }) => {
                      const val = wellnessForm[k as keyof typeof wellnessForm] as number;
                      const color = val >= 7 ? "#00ff87" : val >= 5 ? "#f59e0b" : "#ff3b30";
                      return (
                        <div key={k}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-xs text-white/50"><Icon className="w-3.5 h-3.5" /><span className="font-semibold">{label}</span><span className="opacity-40 hidden sm:inline">— {help}</span></div>
                            <span className="text-sm font-bold" style={{ color }}>{val}/10</span>
                          </div>
                          <input type="range" min={1} max={10} step={1} value={val} onChange={e => setWellnessForm(f => ({ ...f, [k]: Number(e.target.value) }))} className="w-full h-1.5 rounded-full accent-current" style={{ accentColor: color }} />
                        </div>
                      );
                    })}
                    <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Notas</label><textarea rows={2} value={wellnessForm.notes} onChange={e => setWellnessForm(f => ({ ...f, notes: e.target.value }))} className="input w-full resize-none" /></div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowWellnessForm(false); setWellnessErrors({}); }} className="px-4 py-2 rounded-lg text-sm text-white/30 hover:text-white">Cancelar</button>
                      <button onClick={() => { if (validateWellness()) createWellnessMutation.mutate(); }} disabled={createWellnessMutation.isPending} className="btn-primary text-sm disabled:opacity-40">
                        {createWellnessMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
                      </button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {(!wellnessHistory || wellnessHistory.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/30">
                <Heart className="w-10 h-10 mb-3 opacity-30" style={{ color: posConfig.color }} />
                <p>Sin registros de wellness disponibles</p>
              </div>
            ) : (
              <>
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-4">Evolución wellness — últimos {wellnessDays} días</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={[...wellnessHistory].reverse().map((w: any) => ({
                      fecha: w.date?.slice(5) ?? w.created_at?.slice(5, 10) ?? "",
                      score: w.overall_score ?? Math.round(((w.sleep_quality ?? 5) + (w.energy_level ?? 5) + (w.mood ?? 5) + (10 - (w.stress_level ?? 5)) + (w.hydration ?? 5) + (10 - (w.muscle_soreness ?? 5))) / 6 * 10),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="fecha" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="score" stroke={posConfig.color} strokeWidth={2.5} dot={{ fill: posConfig.color, r: 3, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {(() => {
                  const last = wellnessHistory[0];
                  if (!last) return null;
                  const metrics = [
                    { label: "Calidad de sueño", value: last.sleep_quality, icon: Moon, invert: false },
                    { label: "Nivel de energía", value: last.energy_level, icon: Zap, invert: false },
                    { label: "Estado de ánimo", value: last.mood, icon: Heart, invert: false },
                    { label: "Estrés", value: last.stress_level, icon: Activity, invert: true },
                    { label: "Hidratación", value: last.hydration, icon: Droplets, invert: false },
                    { label: "Dolor muscular", value: last.muscle_soreness, icon: Dumbbell, invert: true },
                  ].filter(m => m.value != null);
                  return (
                    <Card>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Último registro</p>
                        <span className="text-xs text-white/30">{last.date ?? last.created_at?.slice(0, 10)}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {metrics.map(({ label, value, icon: Icon, invert }) => {
                          const pct = (value / 10) * 100;
                          const normalized = invert ? 100 - pct : pct;
                          const color = normalized >= 70 ? "#00ff87" : normalized >= 40 ? "#f59e0b" : "#ff3b30";
                          return (
                            <div key={label}>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <div className="flex items-center gap-1.5 text-white/50"><Icon className="w-3.5 h-3.5" />{label}</div>
                                <span className="font-bold" style={{ color }}>{value}/10</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.1 }} className="h-full rounded-full" style={{ background: color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {last.notes && <p className="mt-4 text-xs p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-white/50">{last.notes}</p>}
                    </Card>
                  );
                })()}

                <Card className="overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-white/[0.06]"><p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Historial de registros</p></div>
                  <div className="divide-y divide-white/[0.04]">
                    {wellnessHistory.slice(0, 10).map((w: any, i: number) => {
                      const score = w.overall_score ?? Math.round(((w.sleep_quality ?? 5) + (w.energy_level ?? 5) + (w.mood ?? 5) + (10 - (w.stress_level ?? 5)) + (w.hydration ?? 5) + (10 - (w.muscle_soreness ?? 5))) / 6 * 10);
                      const color = score >= 70 ? "#00ff87" : score >= 50 ? "#f59e0b" : "#ff3b30";
                      return (
                        <motion.div key={w.id ?? i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-5 py-3">
                          <span className="text-xs text-white/30">{w.date ?? w.created_at?.slice(0, 10)}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} /></div>
                            <span className="text-xs font-bold w-8 text-right" style={{ color }}>{score}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )}
          </motion.div>
        )}

        {tab === "Predicción" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {prediction ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="flex flex-col items-center gap-4 py-6">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 self-start">Riesgo de lesión</p>
                    <RiskGauge score={prediction.injury_risk_score} level={prediction.injury_risk_level} size={180} />
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: getRiskConfig(prediction.injury_risk_level).color }}>Riesgo {getRiskConfig(prediction.injury_risk_level).label}</p>
                      <p className="text-xs text-white/30 mt-0.5">Actualizado: {prediction.calculated_at?.slice(0, 10)}</p>
                    </div>
                  </Card>

                  <Card>
                    {prediction.injury_risk_factors && Object.keys(prediction.injury_risk_factors).length > 0 ? (
                      <RiskExplanation
                        score={prediction.injury_risk_score ?? 0}
                        level={prediction.injury_risk_level ?? "low"}
                        factors={prediction.injury_risk_factors}
                      />
                    ) : (
                      <p className="text-sm text-white/30">Sin desglose disponible</p>
                    )}
                  </Card>
                </div>

                {forecastData.length > 0 && (
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Proyección rendimiento 4 semanas</p>
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: trendColor, background: `${trendColor}15` }}>
                        Confianza {prediction.performance_confidence ? `${(prediction.performance_confidence * 100).toFixed(0)}%` : "—"}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={forecastData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="value" stroke={posConfig.color} strokeWidth={2.5} dot={{ fill: posConfig.color, r: 4, strokeWidth: 0 }} strokeDasharray="6 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-white/30">
                <Brain className="w-10 h-10 mb-3 opacity-30" />
                <p>Sin predicciones disponibles para este jugador</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
