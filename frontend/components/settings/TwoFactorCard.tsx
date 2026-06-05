"use client";
/**
 * Two-factor (TOTP) enrolment & management — compliance #11.
 *
 * Mirrors the backend's two-phase design: `setup` stores an *unconfirmed* secret
 * and returns an otpauth URI we render as a QR; `enable` only flips 2FA on once
 * the user proves they can generate a valid code, then shows one-time recovery
 * codes. Disabling requires the account password (+ a current code).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldAlert, Loader2, KeyRound, Copy, Check,
  AlertTriangle, Lock, Smartphone,
} from "lucide-react";
import { GlowCard } from "@/components/ui/GlowCard";
import { mfaApi, type MfaSetup } from "@/lib/api";

const inputCls =
  "w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all focus:ring-2 focus:ring-[rgba(0,255,135,0.3)]";
const inputStyle = {
  background: "var(--surface-3)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
} as const;

export function TwoFactorCard() {
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: () => mfaApi.status(),
  });

  // Enrolment flow
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  // Disable flow
  const [disabling, setDisabling] = useState(false);
  const [disablePwd, setDisablePwd] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const setupMut = useMutation({
    mutationFn: () => mfaApi.setup(),
    onSuccess: (data) => { setSetup(data); setEnrollCode(""); },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? "No se pudo iniciar la configuración"),
  });

  const enableMut = useMutation({
    mutationFn: (code: string) => mfaApi.enable(code),
    onSuccess: (data) => {
      setRecoveryCodes(data.recovery_codes);
      setSetup(null);
      setEnrollCode("");
      qc.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("Verificación en dos pasos activada");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? "Código incorrecto"),
  });

  const disableMut = useMutation({
    mutationFn: (vars: { password: string; code: string }) =>
      mfaApi.disable(vars.password, vars.code || undefined),
    onSuccess: () => {
      setDisabling(false); setDisablePwd(""); setDisableCode("");
      qc.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("Verificación en dos pasos desactivada");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? "No se pudo desactivar"),
  });

  function copyRecovery() {
    if (!recoveryCodes) return;
    navigator.clipboard?.writeText(recoveryCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const enabled = !!status?.enabled;
  const accent = enabled ? "#00ff87" : "#f59e0b";

  return (
    <GlowCard className="rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="p-1.5 rounded-lg" style={{ background: `${accent}1a` }}>
          {enabled
            ? <ShieldCheck className="w-4 h-4" style={{ color: accent }} />
            : <ShieldAlert className="w-4 h-4" style={{ color: accent }} />}
        </div>
        <h3 className="text-sm font-bold">Verificación en dos pasos (2FA)</h3>
        <span
          className="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0"
          style={{ color: accent, background: `${accent}1a`, border: `1px solid ${accent}33` }}
        >
          {enabled ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando estado…
          </div>
        ) : recoveryCodes ? (
          /* ── One-time recovery codes (shown right after enabling) ──────── */
          <div>
            <div
              className="flex items-start gap-2 p-3 rounded-xl mb-3"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Guarda estos <strong>códigos de recuperación</strong> en un lugar seguro. Son tu
                acceso si pierdes el teléfono y <strong>no se volverán a mostrar</strong>.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {recoveryCodes.map((c) => (
                <div
                  key={c}
                  className="text-sm font-mono text-center py-2 rounded-lg tracking-wider"
                  style={{ background: "var(--surface-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                >
                  {c}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={copyRecovery}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                {copied ? <Check className="w-3.5 h-3.5" style={{ color: "#00ff87" }} /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar códigos"}
              </button>
              <button
                onClick={() => setRecoveryCodes(null)}
                className="ml-auto px-4 py-1.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: "var(--brand)", color: "#04140c" }}
              >
                Ya los guardé
              </button>
            </div>
          </div>
        ) : enabled ? (
          /* ── Enabled state ─────────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#00ff87" }} />
              <span>
                Tu cuenta está protegida. Se te pedirá un código al iniciar sesión.
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
              {status?.confirmed_at && (
                <span>Activado el {new Date(status.confirmed_at).toLocaleDateString("es-CL")}</span>
              )}
              <span>· {status?.recovery_codes_remaining ?? 0} códigos de recuperación restantes</span>
            </div>

            {!disabling ? (
              <button
                onClick={() => setDisabling(true)}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(255,59,48,0.10)", border: "1px solid rgba(255,59,48,0.28)", color: "#ff6b60" }}
              >
                Desactivar 2FA
              </button>
            ) : (
              <div
                className="p-4 rounded-xl space-y-3"
                style={{ background: "rgba(255,59,48,0.05)", border: "1px solid rgba(255,59,48,0.20)" }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Confirma tu identidad para desactivar la protección.
                </p>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="password"
                    value={disablePwd}
                    onChange={(e) => setDisablePwd(e.target.value)}
                    placeholder="Tu contraseña"
                    className={inputCls + " pl-9"}
                    style={inputStyle}
                  />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="Código actual (TOTP o recuperación)"
                    className={inputCls + " pl-9 font-mono"}
                    style={inputStyle}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => disableMut.mutate({ password: disablePwd, code: disableCode })}
                    disabled={!disablePwd || disableMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                    style={{ background: "rgba(255,59,48,0.15)", border: "1px solid rgba(255,59,48,0.35)", color: "#ff6b60" }}
                  >
                    {disableMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Confirmar desactivación
                  </button>
                  <button
                    onClick={() => { setDisabling(false); setDisablePwd(""); setDisableCode(""); }}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : setup ? (
          /* ── Enrolment in progress: QR + confirm ───────────────────────── */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <div className="rounded-xl p-3 bg-white shrink-0 mx-auto sm:mx-0">
                <QRCodeSVG value={setup.otpauth_uri} size={148} level="M" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
                  <Smartphone className="w-4 h-4" style={{ color: "var(--brand)" }} />
                  Escanea el QR
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Con Google Authenticator, Authy, 1Password o Microsoft Authenticator. ¿No
                  puedes escanear? Ingresa esta clave manualmente:
                </p>
                <code
                  className="block text-xs font-mono break-all px-3 py-2 rounded-lg"
                  style={{ background: "var(--surface-3)", border: "1px solid var(--border-subtle)", color: "var(--brand)" }}
                >
                  {setup.secret}
                </code>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Ingresa el código de 6 dígitos para confirmar
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    value={enrollCode}
                    onChange={(e) => setEnrollCode(e.target.value)}
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    placeholder="123456"
                    className={inputCls + " pl-9 font-mono tracking-[0.3em]"}
                    style={inputStyle}
                  />
                </div>
                <button
                  onClick={() => enableMut.mutate(enrollCode.replace(/\s/g, ""))}
                  disabled={enrollCode.replace(/\s/g, "").length < 6 || enableMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 shrink-0"
                  style={{ background: "var(--brand)", color: "#04140c" }}
                >
                  {enableMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Activar
                </button>
              </div>
              <button
                onClick={() => { setSetup(null); setEnrollCode(""); }}
                className="text-xs font-semibold mt-2 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          /* ── Not enabled: call to action ───────────────────────────────── */
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Añade una capa extra de seguridad. Tras tu contraseña, se te pedirá un código
              temporal desde tu teléfono — incluso si tu contraseña se filtra, tu cuenta queda
              protegida.
              {status?.enrollment_required && (
                <span className="block mt-1.5 font-semibold" style={{ color: "#f59e0b" }}>
                  Tu rol requiere activar 2FA.
                </span>
              )}
            </p>
            <button
              onClick={() => setupMut.mutate()}
              disabled={setupMut.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: "var(--brand)", color: "#04140c" }}
            >
              {setupMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Activar 2FA
            </button>
          </div>
        )}
      </div>
    </GlowCard>
  );
}
