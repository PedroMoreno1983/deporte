"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  Loader2, Lock, Mail, Eye, EyeOff, ArrowRight,
  Activity, Brain, Shield, Zap, KeyRound, ShieldCheck, ArrowLeft,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { motion } from "framer-motion";

const schema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormData = z.infer<typeof schema>;

const HIGHLIGHTS = [
  { icon: Activity, label: "Wellness en tiempo real" },
  { icon: Brain,    label: "Predicciones ML de lesión" },
  { icon: Shield,   label: "Pizarra táctica colaborativa" },
  { icon: Zap,      label: "Analytics avanzados" },
];

const DEMO_ACCOUNTS: { email: string; password: string; label: string; color: string }[] = [
  { email: "admin@deporte.fc",    password: "demo", label: "Admin",        color: "#a855f7" },
  { email: "coach@deporte.fc",    password: "demo", label: "Entrenador",   color: "#00ff87" },
  { email: "kine@deporte.fc",     password: "demo", label: "Kinesiólogo",  color: "#0ea5e9" },
  { email: "analyst@deporte.fc",  password: "demo", label: "Analista",     color: "#f59e0b" },
];

function PitchBackdrop() {
  // Decorative animated football pitch with neon lines
  return (
    <svg
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    >
      <defs>
        <linearGradient id="pitch-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#00ff87" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.25" />
        </linearGradient>
        <radialGradient id="pitch-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(0,255,135,0.18)" />
          <stop offset="100%" stopColor="rgba(0,255,135,0)" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill="url(#pitch-glow)" />
      {/* outer pitch */}
      <rect x="60" y="60" width="680" height="480" fill="none"
            stroke="url(#pitch-line)" strokeWidth="1.5" />
      {/* center line */}
      <line x1="400" y1="60" x2="400" y2="540" stroke="url(#pitch-line)" strokeWidth="1.2" />
      {/* center circle */}
      <circle cx="400" cy="300" r="70" fill="none" stroke="url(#pitch-line)" strokeWidth="1.2" />
      <circle cx="400" cy="300" r="3"  fill="#00ff87" opacity="0.7" />
      {/* penalty boxes */}
      <rect x="60"  y="180" width="120" height="240" fill="none" stroke="url(#pitch-line)" strokeWidth="1.2" />
      <rect x="620" y="180" width="120" height="240" fill="none" stroke="url(#pitch-line)" strokeWidth="1.2" />
      {/* small boxes */}
      <rect x="60"  y="230" width="50" height="140" fill="none" stroke="url(#pitch-line)" strokeWidth="1.2" />
      <rect x="690" y="230" width="50" height="140" fill="none" stroke="url(#pitch-line)" strokeWidth="1.2" />
      {/* penalty arcs */}
      <path d="M 180 240 Q 220 300 180 360" fill="none" stroke="url(#pitch-line)" strokeWidth="1.2" />
      <path d="M 620 240 Q 580 300 620 360" fill="none" stroke="url(#pitch-line)" strokeWidth="1.2" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  // Two-factor challenge: when the account has 2FA on, /login returns a short-lived
  // mfa_token instead of a session; we then collect a TOTP/recovery code.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const {
    register, handleSubmit, setValue, formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await authApi.login(data.email, data.password);
      if (res.mfa_required && res.mfa_token) {
        setMfaToken(res.mfa_token);
        setCode("");
        return;
      }
      setAuth(res.user, res.access_token!, res.refresh_token!);
      router.push("/dashboard");
    } catch {
      toast.error("Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = code.replace(/\s/g, "");
    if (!mfaToken || cleaned.length < 6) return;
    setVerifying(true);
    try {
      const res = await authApi.loginVerify(mfaToken, cleaned);
      setAuth(res.user, res.access_token!, res.refresh_token!);
      router.push("/dashboard");
    } catch {
      toast.error("Código incorrecto. Intenta nuevamente.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  function fillDemo(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setValue("email", acc.email);
    setValue("password", acc.password);
  }

  return (
    <div className="min-h-screen flex bg-surface-base">
      {/* ─── Left panel: branding (desktop only) ──────────────────── */}
      <div className="hidden lg:flex relative w-1/2 overflow-hidden">
        <PitchBackdrop />

        {/* Overlay gradients for legibility */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(2,8,23,0.85) 0%, rgba(2,8,23,0.55) 50%, rgba(2,8,23,0.85) 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top: logo */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Logo variant="wordmark" size={48} />
          </motion.div>

          {/* Middle: tagline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 max-w-md"
          >
            <h1 className="text-4xl xl:text-5xl font-black leading-tight tracking-tight text-white">
              El centro de mando{" "}
              <span className="gradient-text">de tu club.</span>
            </h1>
            <p className="text-base text-white/55 leading-relaxed">
              Wellness, lesiones, táctica y analytics — todo en una sola
              plataforma diseñada para entrenadores, kinesiólogos y analistas
              que ganan partidos antes que se jueguen.
            </p>

            {/* Highlights */}
            <ul className="grid grid-cols-2 gap-3 pt-2">
              {HIGHLIGHTS.map((h, i) => (
                <motion.li
                  key={h.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05, duration: 0.35 }}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: "rgba(0,255,135,0.10)",
                      border: "1px solid rgba(0,255,135,0.30)",
                    }}
                  >
                    <h.icon className="w-3.5 h-3.5" style={{ color: "#00ff87" }} />
                  </div>
                  <span className="text-white/70 font-medium">{h.label}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Bottom: signature line + version */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-end justify-between gap-4"
          >
            <p className="text-xs text-white/30 font-mono tracking-wider">
              v1.0 · build {new Date().getFullYear()}
            </p>
            <p className="text-[10px] text-white/25 uppercase tracking-[0.18em] font-bold">
              Sports Intelligence Platform
            </p>
          </motion.div>
        </div>
      </div>

      {/* ─── Right panel: form ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative">
        {/* Mobile-only branding strip */}
        <div className="lg:hidden absolute top-0 left-0 right-0 px-6 pt-8 flex justify-center">
          <Logo variant="mark" size={56} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          {mfaToken ? (
          /* ── Second step: 2FA verification (compliance #11) ───────────── */
          <div>
            <div className="mb-8">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(0,255,135,0.18) 0%, rgba(0,255,135,0.06) 100%)",
                  border: "1px solid rgba(0,255,135,0.32)",
                }}
              >
                <ShieldCheck className="w-6 h-6" style={{ color: "var(--brand)" }} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Verificación en dos pasos
              </h2>
              <p className="text-sm text-white/45 mt-1">
                Ingresa el código de 6 dígitos de tu app de autenticación.
              </p>
            </div>

            <form onSubmit={verifyMfa} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold tracking-wider uppercase text-white/40 mb-1.5">
                  Código de verificación
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="123456"
                    maxLength={14}
                    className="input w-full pl-10 tracking-[0.4em] font-mono text-lg"
                  />
                </div>
                <p className="text-[11px] mt-1.5 text-white/30">
                  ¿Perdiste tu teléfono? Usa uno de tus códigos de recuperación.
                </p>
              </div>

              <button
                type="submit"
                disabled={verifying || code.replace(/\s/g, "").length < 6}
                className="btn-primary w-full mt-2 group"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                  </>
                ) : (
                  <>
                    Verificar e ingresar
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMfaToken(null); setCode(""); }}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors mt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio de sesión
              </button>
            </form>
          </div>
          ) : (
          <>
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Bienvenido de vuelta
            </h2>
            <p className="text-sm text-white/45 mt-1">
              Inicia sesión para acceder a tu equipo.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold tracking-wider uppercase text-white/40 mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="tu@deportefc.cl"
                  className="input w-full pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold tracking-wider uppercase text-white/40">
                  Contraseña
                </label>
                <a
                  href="#"
                  className="text-[11px] font-semibold hover:underline"
                  style={{ color: "var(--brand)" }}
                  onClick={(e) => { e.preventDefault(); toast.info("Contacta al administrador para restablecer"); }}
                >
                  ¿La olvidaste?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  {...register("password")}
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input w-full pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/30 hover:text-white/70 transition-colors"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Ingresando...
                </>
              ) : (
                <>
                  Ingresar al sistema
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/30">
                Cuentas demo
              </span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: `${acc.color}10`,
                    border: `1px solid ${acc.color}28`,
                    color: acc.color,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${acc.color}20`;
                    e.currentTarget.style.borderColor = `${acc.color}50`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${acc.color}10`;
                    e.currentTarget.style.borderColor = `${acc.color}28`;
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: acc.color, boxShadow: `0 0 6px ${acc.color}` }}
                  />
                  {acc.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-3 text-center">
              Click para autocompletar credenciales demo
            </p>
          </div>
          </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
