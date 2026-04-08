"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { playersApi, kinesiologyApi } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ArrowLeft, Activity, Loader2, Check, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const inputCls = "w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all duration-200 focus:ring-2 focus:ring-[rgba(0,255,135,0.3)]";
const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
};
const labelCls = "text-xs font-semibold block mb-1.5";

type FormState = {
  evaluation_date: string;
  evaluated_by: string;
  // Composición
  weight_kg: string; height_cm: string; body_fat_percentage: string;
  muscle_mass_kg: string; bmi: string;
  // Fuerza
  squat_1rm_kg: string; bench_press_1rm_kg: string;
  nordic_hamstring_left: string; nordic_hamstring_right: string;
  // Salto
  cmj_height_cm: string; sj_height_cm: string; abalakov_height_cm: string;
  // Flexibilidad
  sit_and_reach_cm: string; thomas_test_left: string; thomas_test_right: string;
  hamstring_flexibility_left: string; hamstring_flexibility_right: string;
  // Aeróbico
  vo2_max: string; yo_yo_test_level: string; yo_yo_test_distance: string;
  // Velocidad
  sprint_10m_sec: string; sprint_30m_sec: string; sprint_40m_sec: string;
  notes: string;
};

const EMPTY: FormState = {
  evaluation_date: new Date().toISOString().split("T")[0],
  evaluated_by: "",
  weight_kg: "", height_cm: "", body_fat_percentage: "",
  muscle_mass_kg: "", bmi: "",
  squat_1rm_kg: "", bench_press_1rm_kg: "",
  nordic_hamstring_left: "", nordic_hamstring_right: "",
  cmj_height_cm: "", sj_height_cm: "", abalakov_height_cm: "",
  sit_and_reach_cm: "", thomas_test_left: "", thomas_test_right: "",
  hamstring_flexibility_left: "", hamstring_flexibility_right: "",
  vo2_max: "", yo_yo_test_level: "", yo_yo_test_distance: "",
  sprint_10m_sec: "", sprint_30m_sec: "", sprint_40m_sec: "",
  notes: "",
};

function numOrNull(v: string) {
  return v !== "" ? Number(v) : null;
}

export default function NewKinesiologyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const playerId = Number(id);

  const { data: player } = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => playersApi.get(playerId),
  });

  const [form, setForm] = useState<FormState>(EMPTY);

  const set = (k: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [k]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: () =>
      kinesiologyApi.create({
        player_id: playerId,
        evaluation_date: form.evaluation_date,
        evaluated_by: form.evaluated_by || null,
        weight_kg: numOrNull(form.weight_kg),
        height_cm: numOrNull(form.height_cm),
        body_fat_percentage: numOrNull(form.body_fat_percentage),
        muscle_mass_kg: numOrNull(form.muscle_mass_kg),
        bmi: numOrNull(form.bmi),
        squat_1rm_kg: numOrNull(form.squat_1rm_kg),
        bench_press_1rm_kg: numOrNull(form.bench_press_1rm_kg),
        nordic_hamstring_left: numOrNull(form.nordic_hamstring_left),
        nordic_hamstring_right: numOrNull(form.nordic_hamstring_right),
        cmj_height_cm: numOrNull(form.cmj_height_cm),
        sj_height_cm: numOrNull(form.sj_height_cm),
        abalakov_height_cm: numOrNull(form.abalakov_height_cm),
        sit_and_reach_cm: numOrNull(form.sit_and_reach_cm),
        thomas_test_left: numOrNull(form.thomas_test_left),
        thomas_test_right: numOrNull(form.thomas_test_right),
        hamstring_flexibility_left: numOrNull(form.hamstring_flexibility_left),
        hamstring_flexibility_right: numOrNull(form.hamstring_flexibility_right),
        vo2_max: numOrNull(form.vo2_max),
        yo_yo_test_level: form.yo_yo_test_level || null,
        yo_yo_test_distance: numOrNull(form.yo_yo_test_distance),
        sprint_10m_sec: numOrNull(form.sprint_10m_sec),
        sprint_30m_sec: numOrNull(form.sprint_30m_sec),
        sprint_40m_sec: numOrNull(form.sprint_40m_sec),
        notes: form.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kinesiology", playerId] });
      toast.success("Evaluación kinesiológica registrada");
      router.push(`/players/${playerId}`);
    },
    onError: () => toast.error("Error al guardar la evaluación"),
  });

  const Section = ({ title, color = "var(--neon)" }: { title: string; color?: string }) => (
    <p className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
      <span className="w-1 h-3 rounded-full inline-block" style={{ background: color }} />
      {title}
    </p>
  );

  const Field = ({
    label, k, unit, step = "0.1", min, max
  }: {
    label: string; k: keyof FormState; unit?: string; step?: string; min?: string; max?: string;
  }) => (
    <div>
      <label className={labelCls} style={{ color: "var(--text-secondary)" }}>
        {label}{unit && <span className="ml-1 font-normal opacity-50">({unit})</span>}
      </label>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={form[k]}
        onChange={set(k)}
        placeholder="—"
        className={inputCls}
        style={inputStyle}
      />
    </div>
  );

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pl-12 lg:pl-0">
        <PageHeader
          icon={ClipboardList}
          title="Nueva evaluación kinesiológica"
          description={player ? `${player.first_name} ${player.last_name}` : "Cargando..."}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10 border-cyan-500/20"
          className="mb-0 flex-1"
        />
        <Link href={`/players/${playerId}`}>
          <button
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-colors"
            style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Evaluación & Composición corporal ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="space-y-4"
        >
          {/* Encabezado de evaluación */}
          <GlowCard className="p-5 rounded-2xl">
            <Section title="Encabezado" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Fecha de evaluación *</label>
                <input
                  type="date"
                  value={form.evaluation_date}
                  onChange={set("evaluation_date")}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Evaluador</label>
                <input
                  type="text"
                  value={form.evaluated_by}
                  onChange={set("evaluated_by")}
                  placeholder="Nombre del kinesiólogo"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
          </GlowCard>

          {/* Composición corporal */}
          <GlowCard className="p-5 rounded-2xl">
            <Section title="Composición corporal" color="#0ea5e9" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Peso" k="weight_kg" unit="kg" />
              <Field label="Talla" k="height_cm" unit="cm" step="0.5" />
              <Field label="% Grasa" k="body_fat_percentage" unit="%" step="0.1" />
              <Field label="Masa muscular" k="muscle_mass_kg" unit="kg" />
              <Field label="IMC" k="bmi" unit="kg/m²" />
            </div>
          </GlowCard>

          {/* Fuerza */}
          <GlowCard className="p-5 rounded-2xl">
            <Section title="Tests de fuerza" color="#f97316" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Squat 1RM" k="squat_1rm_kg" unit="kg" />
              <Field label="Press banca 1RM" k="bench_press_1rm_kg" unit="kg" />
              <Field label="Nordic izquierdo" k="nordic_hamstring_left" unit="N" step="1" />
              <Field label="Nordic derecho" k="nordic_hamstring_right" unit="N" step="1" />
            </div>
          </GlowCard>

          {/* Velocidad */}
          <GlowCard className="p-5 rounded-2xl">
            <Section title="Velocidad" color="#ff3b30" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="Sprint 10m" k="sprint_10m_sec" unit="seg" step="0.01" />
              <Field label="Sprint 30m" k="sprint_30m_sec" unit="seg" step="0.01" />
              <Field label="Sprint 40m" k="sprint_40m_sec" unit="seg" step="0.01" />
            </div>
          </GlowCard>
        </motion.div>

        {/* ── Salto, Flexibilidad, Aeróbico, Notas ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Salto */}
          <GlowCard className="p-5 rounded-2xl">
            <Section title="Tests de salto" color="#00ff87" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="CMJ" k="cmj_height_cm" unit="cm" />
              <Field label="SJ" k="sj_height_cm" unit="cm" />
              <Field label="Abalakov" k="abalakov_height_cm" unit="cm" />
            </div>
          </GlowCard>

          {/* Flexibilidad */}
          <GlowCard className="p-5 rounded-2xl">
            <Section title="Flexibilidad" color="#a78bfa" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sit & reach" k="sit_and_reach_cm" unit="cm" />
              <div />
              <Field label="Thomas izquierdo" k="thomas_test_left" unit="°" />
              <Field label="Thomas derecho" k="thomas_test_right" unit="°" />
              <Field label="Isquio izquierdo" k="hamstring_flexibility_left" unit="°" />
              <Field label="Isquio derecho" k="hamstring_flexibility_right" unit="°" />
            </div>
          </GlowCard>

          {/* Aeróbico */}
          <GlowCard className="p-5 rounded-2xl">
            <Section title="Capacidad aeróbica" color="#f59e0b" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="VO₂ máx" k="vo2_max" unit="ml/kg/min" step="0.1" />
              <Field label="Yo-yo dist." k="yo_yo_test_distance" unit="m" step="1" />
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Yo-yo nivel</label>
                <input
                  type="text"
                  value={form.yo_yo_test_level}
                  onChange={set("yo_yo_test_level")}
                  placeholder="Ej: 16.1"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
          </GlowCard>

          {/* Notas */}
          <GlowCard className="p-5 rounded-2xl">
            <Section title="Observaciones" />
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={4}
              placeholder="Anotaciones, recomendaciones, alertas..."
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
          </GlowCard>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <Link href={`/players/${playerId}`}>
              <button className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={{ color: "var(--text-muted)" }}>
                Cancelar
              </button>
            </Link>
            <motion.button
              whileHover={{ scale: !saveMutation.isPending ? 1.02 : 1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => saveMutation.mutate()}
              disabled={!form.evaluation_date || saveMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: "var(--neon)",
                color: "#000",
                boxShadow: "0 0 20px rgba(0,255,135,0.35)",
              }}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saveMutation.isPending ? "Guardando..." : "Guardar evaluación"}
            </motion.button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
