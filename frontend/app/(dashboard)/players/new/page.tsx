"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { playersApi, categoriesApi } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ArrowLeft, UserPlus, Upload, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const POSITIONS = [
  { value: "goalkeeper",    label: "Portero" },
  { value: "center_back",   label: "Defensa Central" },
  { value: "left_back",     label: "Lateral Izquierdo" },
  { value: "right_back",    label: "Lateral Derecho" },
  { value: "defensive_mid", label: "Mediocampista Defensivo" },
  { value: "central_mid",   label: "Mediocampista Central" },
  { value: "attacking_mid", label: "Mediocampista Ofensivo" },
  { value: "left_wing",     label: "Extremo Izquierdo" },
  { value: "right_wing",    label: "Extremo Derecho" },
  { value: "center_forward","label": "Delantero Centro" },
];

const FEET = [
  { value: "right",    label: "Derecho" },
  { value: "left",     label: "Izquierdo" },
  { value: "both",     label: "Ambidextro" },
];

const inputCls = "w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all duration-200 focus:ring-2 focus:ring-[rgba(0,255,135,0.3)]";
const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
};
const labelCls = "text-xs font-semibold block mb-1.5";

export default function NewPlayerPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: "", last_name: "", date_of_birth: "",
    nationality: "", document_id: "", phone: "", email: "",
    jersey_number: "", position: "center_mid", secondary_position: "",
    dominant_foot: "right", category_id: "",
    height_cm: "", weight_kg: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        jersey_number: form.jersey_number ? Number(form.jersey_number) : undefined,
        category_id: Number(form.category_id),
        height_cm: form.height_cm ? Number(form.height_cm) : undefined,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
        secondary_position: form.secondary_position || undefined,
      };
      const player = await playersApi.create(payload);
      if (photoFile) {
        await playersApi.uploadPhoto(player.id, photoFile);
      }
      return player;
    },
    onSuccess: (player) => {
      qc.invalidateQueries({ queryKey: ["players"] });
      toast.success(`${player.first_name} ${player.last_name} agregado al plantel`);
      router.push(`/players/${player.id}`);
    },
    onError: () => toast.error("Error al crear el jugador"),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) { toast.error("La imagen no puede superar 1 MB"); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const canSubmit = form.first_name && form.last_name && form.date_of_birth && form.category_id && form.position;
  const initials = form.first_name && form.last_name
    ? `${form.first_name.charAt(0)}${form.last_name.charAt(0)}`.toUpperCase()
    : "?";

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pl-12 lg:pl-0">
        <PageHeader
          icon={UserPlus}
          title="Nuevo jugador"
          description="Registra un nuevo jugador en el plantel"
          className="mb-0 flex-1"
        />
        <Link href="/players">
          <button
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-colors"
            style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Photo & preview card ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <GlowCard className="p-6 rounded-2xl flex flex-col items-center gap-5 h-full">
            {/* Avatar preview */}
            <div
              className="w-28 h-28 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer relative group"
              style={{ background: "rgba(0,255,135,0.06)", border: "2px solid rgba(0,255,135,0.3)" }}
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black" style={{ color: "var(--neon)" }}>{initials}</span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                <Upload className="w-6 h-6 text-white" />
              </div>
            </div>

            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto} />

            <div className="text-center">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.25)", color: "var(--neon)" }}
              >
                <Upload className="w-3.5 h-3.5" />
                {photoFile ? "Cambiar foto" : "Subir foto"}
              </button>
              {photoFile && (
                <div className="flex items-center gap-1.5 mt-2 justify-center">
                  <Check className="w-3 h-3 text-green-400" />
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{photoFile.name}</p>
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                    <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
              )}
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>JPG, PNG o WebP · máx. 1 MB</p>
            </div>

            {/* Mini info preview */}
            {(form.first_name || form.last_name) && (
              <div className="w-full text-center pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <p className="text-base font-black text-white">
                  {form.first_name} {form.last_name}
                </p>
                {form.jersey_number && (
                  <p className="text-sm font-mono" style={{ color: "var(--neon)" }}>#{form.jersey_number}</p>
                )}
                {form.position && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {POSITIONS.find(p => p.value === form.position)?.label}
                  </p>
                )}
              </div>
            )}
          </GlowCard>
        </motion.div>

        {/* ── Form ── */}
        <motion.div
          className="lg:col-span-2 space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Personal data */}
          <GlowCard className="p-5 rounded-2xl">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Datos personales
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Nombre *</label>
                <input value={form.first_name} onChange={set("first_name")} placeholder="Pedro" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Apellido *</label>
                <input value={form.last_name} onChange={set("last_name")} placeholder="García" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Fecha de nacimiento *</label>
                <input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Nacionalidad</label>
                <input value={form.nationality} onChange={set("nationality")} placeholder="Chileno" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>RUT / Documento</label>
                <input value={form.document_id} onChange={set("document_id")} placeholder="12.345.678-9" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Teléfono</label>
                <input value={form.phone} onChange={set("phone")} placeholder="+56 9 1234 5678" className={inputCls} style={inputStyle} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Email</label>
                <input type="email" value={form.email} onChange={set("email")} placeholder="jugador@club.com" className={inputCls} style={inputStyle} />
              </div>
            </div>
          </GlowCard>

          {/* Deportivo */}
          <GlowCard className="p-5 rounded-2xl">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Datos deportivos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Categoría *</label>
                <select value={form.category_id} onChange={set("category_id")} className={inputCls} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Seleccionar...</option>
                  {(categories as any[]).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Dorsal</label>
                <input type="number" min={1} max={99} value={form.jersey_number} onChange={set("jersey_number")} placeholder="10" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Posición principal *</label>
                <select value={form.position} onChange={set("position")} className={inputCls} style={{ ...inputStyle, cursor: "pointer" }}>
                  {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Posición secundaria</label>
                <select value={form.secondary_position} onChange={set("secondary_position")} className={inputCls} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Sin posición secundaria</option>
                  {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Pie dominante</label>
                <select value={form.dominant_foot} onChange={set("dominant_foot")} className={inputCls} style={{ ...inputStyle, cursor: "pointer" }}>
                  {FEET.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
          </GlowCard>

          {/* Físico */}
          <GlowCard className="p-5 rounded-2xl">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Datos físicos
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Altura (cm)</label>
                <input type="number" min={140} max={220} value={form.height_cm} onChange={set("height_cm")} placeholder="178" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Peso (kg)</label>
                <input type="number" min={40} max={120} value={form.weight_kg} onChange={set("weight_kg")} placeholder="75" className={inputCls} style={inputStyle} />
              </div>
            </div>
          </GlowCard>

          {/* Submit */}
          <div className="flex items-center gap-3 justify-end">
            <Link href="/players">
              <button className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={{ color: "var(--text-muted)" }}>
                Cancelar
              </button>
            </Link>
            <motion.button
              whileHover={{ scale: canSubmit && !createMutation.isPending ? 1.02 : 1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: "var(--neon)",
                color: "#000",
                boxShadow: canSubmit ? "0 0 20px rgba(0,255,135,0.35)" : "none",
              }}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {createMutation.isPending ? "Guardando..." : "Crear jugador"}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
