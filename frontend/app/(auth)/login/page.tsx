"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Loader2, Shield, Lock, Mail } from "lucide-react";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormData = z.infer<typeof schema>;

// SVG particle dots
const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  opacity: Math.random() * 0.3 + 0.05,
}));

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.user, res.access_token, res.refresh_token);
      router.push("/dashboard");
    } catch {
      toast.error("Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* ── Animated mesh background ──────────────────── */}
      <div className="absolute inset-0 mesh-background" />

      {/* ── SVG Particles ─────────────────────────────── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        {PARTICLES.map((p) => (
          <circle
            key={p.id}
            cx={`${p.x}%`}
            cy={`${p.y}%`}
            r={p.size}
            fill="var(--neon)"
            opacity={p.opacity}
          />
        ))}
        {/* Connection lines */}
        {PARTICLES.slice(0, 15).map((p, i) => {
          const next = PARTICLES[(i + 1) % 15];
          const dist = Math.hypot(p.x - next.x, p.y - next.y);
          if (dist > 30) return null;
          return (
            <line
              key={`l-${i}`}
              x1={`${p.x}%`} y1={`${p.y}%`}
              x2={`${next.x}%`} y2={`${next.y}%`}
              stroke="var(--neon)" strokeWidth="0.5"
              opacity={0.06}
            />
          );
        })}
      </svg>

      {/* ── Glow orbs ─────────────────────────────────── */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,255,135,0.06) 0%, transparent 70%)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 70%)" }} />

      {/* ── Card ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md mx-4"
      >
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(10,15,30,0.85)",
            backdropFilter: "blur(24px)",
            border: "1px solid var(--border-medium)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{
                background: "rgba(0,255,135,0.08)",
                border: "1px solid rgba(0,255,135,0.2)",
                boxShadow: "0 0 32px rgba(0,255,135,0.2), inset 0 0 16px rgba(0,255,135,0.05)",
              }}
            >
              <Shield className="w-7 h-7" style={{ color: "var(--neon)" }} />
            </motion.div>

            <div className="flex items-baseline justify-center gap-2">
              <span className="text-3xl font-black tracking-tight text-white">DEPORTE</span>
              <span className="text-3xl font-black tracking-tight" style={{ color: "var(--neon)" }}>FC</span>
            </div>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Plataforma de Gestión Deportiva
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                style={{ color: "var(--text-muted)" }}>
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--text-muted)" }} />
                <input
                  {...register("email")}
                  type="email"
                  placeholder="tu@deportefc.cl"
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl outline-none transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = "rgba(0,255,135,0.4)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(0,255,135,0.08)";
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = "var(--border-subtle)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              {errors.email && (
                <p className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                style={{ color: "var(--text-muted)" }}>
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--text-muted)" }} />
                <input
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl outline-none transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = "rgba(0,255,135,0.4)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(0,255,135,0.08)";
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = "var(--border-subtle)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              {errors.password && (
                <p className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3 rounded-xl text-sm font-bold mt-2 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                background: "var(--neon)",
                color: "#000",
                boxShadow: "0 0 24px rgba(0,255,135,0.35)",
              }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Ingresando...</>
              ) : "Ingresar al sistema"}
            </motion.button>
          </form>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs"
            style={{ color: "var(--text-muted)" }}>
            <div className="status-dot" style={{ width: 6, height: 6, background: "var(--neon)" }} />
            <span>Sistema seguro — Acceso con JWT</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
