"use client";
/**
 * Custom onboarding tour for first-time users.
 * Uses `data-tour-id` attributes to locate targets in the DOM.
 * Persists completion in localStorage so it only runs once.
 *
 * To add a step: add `data-tour-id="my-id"` to the element and append
 * a step to TOUR_STEPS below.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const STORAGE_KEY = "deporte_onboarding_seen_v1";

interface Step {
  id: string;
  title: string;
  body: string;
  placement?: "bottom" | "right" | "top" | "left" | "center";
}

const TOUR_STEPS: Step[] = [
  {
    id: "__welcome__",
    title: "Bienvenido a Deporte FC",
    body: "Te mostramos en 30 segundos los lugares clave de la plataforma. Puedes saltarlo cuando quieras.",
    placement: "center",
  },
  {
    id: "sidebar-nav",
    title: "Tu menú principal",
    body: "Aquí navegas entre Dashboard, Jugadores, Lesiones, Wellness, Pizarra táctica y Analytics. Cambia según tu rol.",
    placement: "right",
  },
  {
    id: "notification-bell",
    title: "Alertas en tiempo real",
    body: "Lesiones, wellness bajo y predicciones de riesgo aparecen acá. Puedes enviar alertas por email al cuerpo técnico.",
    placement: "right",
  },
  {
    id: "kpi-row",
    title: "Tus KPIs clave",
    body: "Disponibilidad del plantel, lesiones activas y partidos recientes — un vistazo y entiendes el estado del equipo.",
    placement: "bottom",
  },
  {
    id: "__finish__",
    title: "Listo para empezar",
    body: "Puedes volver a ver este tour desde Configuración → Reiniciar onboarding. ¡Buena temporada!",
    placement: "center",
  },
];

function useTargetRect(id: string | null, step: number) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!id || id.startsWith("__")) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(`[data-tour-id="${id}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [id, step]);

  return rect;
}

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && !window.localStorage.getItem(STORAGE_KEY)) {
      // Wait a moment so the dashboard finishes mounting
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const finish = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setOpen(false);
    setStep(0);
  };

  const current = TOUR_STEPS[step];
  const targetRect = useTargetRect(current?.id ?? null, step);
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  const total = TOUR_STEPS.length;

  if (!mounted || !open || !current) return null;

  // Compute tooltip position — clamps to viewport so the tooltip is always
  // fully visible, even when the target sits near a window edge.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TOOLTIP_W = Math.min(320, vw - 32);
  const TOOLTIP_H_ESTIMATE = 200;
  const TOOLTIP_GAP = 16;
  const MARGIN = 12;

  let tipLeft = 0;
  let tipTop = 0;
  let tipTransform = "";

  // On narrow screens, force center placement (much more usable on phones)
  const placement = vw < 720 ? "center" : (current.placement ?? "center");

  if (placement === "center" || !targetRect) {
    tipLeft = vw / 2;
    tipTop = vh / 2;
    tipTransform = "translate(-50%, -50%)";
  } else if (placement === "bottom") {
    tipLeft = targetRect.left + targetRect.width / 2;
    tipTop = targetRect.bottom + TOOLTIP_GAP;
    tipTransform = "translateX(-50%)";
  } else if (placement === "top") {
    tipLeft = targetRect.left + targetRect.width / 2;
    tipTop = targetRect.top - TOOLTIP_GAP;
    tipTransform = "translate(-50%, -100%)";
  } else if (placement === "right") {
    tipLeft = targetRect.right + TOOLTIP_GAP;
    tipTop = targetRect.top + targetRect.height / 2;
    tipTransform = "translateY(-50%)";
  } else if (placement === "left") {
    tipLeft = targetRect.left - TOOLTIP_GAP;
    tipTop = targetRect.top + targetRect.height / 2;
    tipTransform = "translate(-100%, -50%)";
  }

  // Clamp horizontally
  const maxLeft = vw - TOOLTIP_W - MARGIN;
  if (tipTransform.includes("translateX(-50%)") || tipTransform.includes("translate(-50%, -50%)")) {
    tipLeft = Math.max(TOOLTIP_W / 2 + MARGIN, Math.min(tipLeft, maxLeft + TOOLTIP_W / 2));
  } else if (tipTransform.includes("translate(-100%")) {
    tipLeft = Math.max(TOOLTIP_W + MARGIN, Math.min(tipLeft, vw - MARGIN));
  } else {
    tipLeft = Math.max(MARGIN, Math.min(tipLeft, maxLeft));
  }

  // Clamp vertically — keep the whole tooltip visible
  const isVerticalCentered = tipTransform.includes(", -50%)") || tipTransform.includes(", -100%)");
  if (tipTransform.includes("translate(-50%, -50%)")) {
    tipTop = Math.max(TOOLTIP_H_ESTIMATE / 2 + MARGIN, Math.min(tipTop, vh - TOOLTIP_H_ESTIMATE / 2 - MARGIN));
  } else if (tipTransform.includes(", -100%)")) {
    tipTop = Math.max(TOOLTIP_H_ESTIMATE + MARGIN, Math.min(tipTop, vh - MARGIN));
  } else if (isVerticalCentered) {
    tipTop = Math.max(TOOLTIP_H_ESTIMATE / 2 + MARGIN, Math.min(tipTop, vh - TOOLTIP_H_ESTIMATE / 2 - MARGIN));
  } else {
    tipTop = Math.max(MARGIN, Math.min(tipTop, vh - TOOLTIP_H_ESTIMATE - MARGIN));
  }

  const overlay = (
    <div className="fixed inset-0 z-[100] pointer-events-auto">
      {/* Backdrop with hole over the target */}
      <svg
        className="absolute inset-0 w-full h-full"
        width="100%" height="100%"
        style={{ pointerEvents: "auto" }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(2,8,23,0.78)"
          mask="url(#tour-mask)"
        />
        {/* Neon highlight border around target */}
        {targetRect && (
          <rect
            x={targetRect.left - 6}
            y={targetRect.top - 6}
            width={targetRect.width + 12}
            height={targetRect.height + 12}
            rx={12}
            fill="none"
            stroke="#c0432b"
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 12px rgba(192,67,43,0.7))" }}
          />
        )}
      </svg>

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="absolute rounded-2xl"
          style={{
            left: tipLeft,
            top: tipTop,
            transform: tipTransform,
            width: TOOLTIP_W,
            padding: 20,
            background: "var(--paper-card)",
            border: "1.5px solid var(--rule)",
            boxShadow: "4px 8px 0 rgba(44,38,32,0.10), 0 24px 64px rgba(44,38,32,0.22)",
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {isFirst ? (
                <Logo variant="mark" size={28} flat />
              ) : (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(192,67,43,0.12)",
                    border: "1px solid rgba(192,67,43,0.30)",
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "#c0432b" }} />
                </div>
              )}
              <h3 className="text-sm font-bold tracking-tight truncate" style={{ color: "var(--ink)" }}>
                {current.title}
              </h3>
            </div>
            <button
              onClick={finish}
              className="p-1 rounded-md transition-colors shrink-0"
              style={{ color: "var(--ink-faint)" }}
              aria-label="Cerrar tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{current.body}</p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: i === step ? 18 : 6,
                    height: 6,
                    background:
                      i === step ? "#c0432b" : i < step ? "rgba(192,67,43,0.5)" : "rgba(44,38,32,0.18)",
                  }}
                />
              ))}
              <span className="text-[10px] font-mono ml-2 tabular-nums" style={{ color: "var(--ink-faint)" }}>
                {step + 1}/{total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isLast && (
                <button
                  onClick={finish}
                  className="text-xs font-semibold transition-colors px-2 py-1"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Saltar
                </button>
              )}
              <button
                onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: "#c0432b",
                  color: "#faf4e8",
                }}
              >
                {isLast ? "Comenzar" : "Siguiente"}
                {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(overlay, document.body);
}

/** Manually re-trigger the tour (used from Configuración) */
export function resetOnboarding() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
}
