"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, alertsApi } from "@/lib/api";
import { useRealtime } from "@/lib/ws";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertTriangle, Heart, Shield, X, ChevronRight, Mail, Loader2, Check } from "lucide-react";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";

type Notification = {
  id: string;
  type: "lesion_activa" | "wellness_bajo" | "riesgo_alto";
  severity: "critica" | "alta" | "media" | "baja";
  title: string;
  message: string;
  player_id: number;
  player_name: string;
  date: string;
};

const TYPE_CONFIG = {
  lesion_activa: { icon: AlertTriangle, label: "Lesión" },
  wellness_bajo:  { icon: Heart,         label: "Wellness" },
  riesgo_alto:   { icon: Shield,         label: "Riesgo"   },
};

const SEV_COLOR: Record<string, string> = {
  critica: "#ff3b30",
  alta:    "#f97316",
  media:   "#f59e0b",
  baja:    "#c0432b",
};

const PANEL_WIDTH = 340;
const PANEL_GAP   = 12;

export function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [emailInput, setEmailInput] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; align: "right" | "below" }>({
    left: 0, top: 0, align: "right",
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const sendMutation = useMutation({
    mutationFn: (email: string) => alertsApi.send([email]),
    onSuccess: (data) => {
      setEmailSent(true);
      setEmailInput("");
      toast.success(data.message ?? "Alerta enviada");
      setTimeout(() => setEmailSent(false), 3000);
    },
    onError: () => toast.error("Error al enviar alerta"),
  });

  const qc = useQueryClient();
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  useRealtime("notifications", (event) => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (event.type === "notification.new") {
      const kind = event.payload?.kind as string | undefined;
      const label =
        kind === "lesion_activa" ? "Nueva lesión activa"
        : kind === "wellness_bajo" ? "Wellness bajo detectado"
        : kind === "riesgo_alto" ? "Riesgo de lesión elevado"
        : "Nueva alerta";
      const color =
        kind === "lesion_activa" || kind === "riesgo_alto" ? "#ff3b30" : "#f59e0b";
      toast(label, {
        description: "Click en la campana para ver detalles",
        style: {
          background: "rgba(8,15,32,0.95)",
          border: `1px solid ${color}40`,
          color: "white",
          boxShadow: `0 0 24px ${color}30`,
        },
      });
    }
  });

  const unread = notifications.filter((n) => !read.has(n.id));

  // Compute panel position relative to the button — clamps to viewport
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const compute = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isNarrow = vw < 720;

      let left: number;
      let top: number;
      let align: "right" | "below";

      if (isNarrow) {
        // On phones: center horizontally beneath the bell
        left = Math.max(8, Math.min((vw - Math.min(PANEL_WIDTH, vw - 16)) / 2, vw - PANEL_WIDTH - 8));
        top  = Math.min(r.bottom + PANEL_GAP, vh - 100);
        align = "below";
      } else {
        // Desktop: drop panel to the right of the sidebar bell
        left = r.right + PANEL_GAP;
        // Anchor so panel does not overflow the viewport bottom
        const desiredTop = r.top - 40;
        const maxPanelH = vh - 32;
        top = Math.max(8, Math.min(desiredTop, vh - Math.min(540, maxPanelH) - 8));
        align = "right";
      }
      setPos({ left, top, align });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(t) &&
        panelRef.current  && !panelRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const markAllRead = () => setRead(new Set(notifications.map((n) => n.id)));

  return (
    <div className="relative" data-tour-id="notification-bell">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Alertas"
        aria-expanded={open}
        className="relative flex items-center gap-2 p-2 rounded-xl transition-all duration-150 w-full"
        style={{
          color: open ? "#c0432b" : "rgba(255,255,255,0.45)",
          background: open ? "rgba(192,67,43,0.08)" : "transparent",
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
        title="Notificaciones"
      >
        <Bell className="w-[18px] h-[18px]" />
        {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Alertas</span>}

        {/* Badge */}
        {unread.length > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute flex items-center justify-center text-[9px] font-black rounded-full"
            style={{
              top: collapsed ? 2 : -2,
              right: collapsed ? 2 : -4,
              minWidth: 16,
              height: 16,
              background: unread.some((n) => n.severity === "critica") ? "#ff3b30" : "#f59e0b",
              color: "#000",
              boxShadow: `0 0 8px ${unread.some((n) => n.severity === "critica") ? "rgba(255,59,48,0.6)" : "rgba(245,158,11,0.6)"}`,
              padding: "0 3px",
            }}
          >
            {unread.length > 9 ? "9+" : unread.length}
          </motion.span>
        )}
      </button>

      {/* Panel — rendered in a portal so it escapes the sidebar overflow */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, scale: 0.96, x: pos.align === "right" ? -6 : 0, y: pos.align === "below" ? -6 : 0 }}
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="fixed z-[60] rounded-2xl overflow-hidden flex flex-col"
                style={{
                  left: pos.left,
                  top:  pos.top,
                  width: Math.min(PANEL_WIDTH, typeof window !== "undefined" ? window.innerWidth - 16 : PANEL_WIDTH),
                  maxHeight: "min(540px, calc(100vh - 32px))",
                  background: "rgba(8,15,32,0.96)",
                  backdropFilter: "blur(20px) saturate(180%)",
                  border: "1px solid rgba(192,67,43,0.20)",
                  boxShadow:
                    "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 24px rgba(192,67,43,0.10)",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Bell className="w-3.5 h-3.5 shrink-0" style={{ color: "#c0432b" }} />
                    <span className="text-sm font-bold">Alertas</span>
                    {unread.length > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
                      >
                        {unread.length} nueva{unread.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {unread.length > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[10px] font-semibold transition-colors"
                        style={{ color: "#c0432b" }}
                      >
                        Marcar leídas
                      </button>
                    )}
                    <button
                      onClick={() => setOpen(false)}
                      className="p-1 rounded-lg transition-colors"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                      aria-label="Cerrar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 min-h-0">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <div
                        className="p-3 rounded-xl"
                        style={{ background: "rgba(192,67,43,0.06)", border: "1px solid rgba(192,67,43,0.15)" }}
                      >
                        <Bell className="w-5 h-5" style={{ color: "#c0432b" }} />
                      </div>
                      <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Sin alertas activas
                      </p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                        El plantel está en buenas condiciones
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      {notifications.map((n, i) => {
                        const cfg = TYPE_CONFIG[n.type];
                        const Icon = cfg.icon;
                        const color = SEV_COLOR[n.severity] ?? "#64748b";
                        const isNew = !read.has(n.id);
                        return (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                          >
                            <Link
                              href={`/players/${n.player_id}`}
                              onClick={() => {
                                setRead((prev) => new Set(Array.from(prev).concat(n.id)));
                                setOpen(false);
                              }}
                            >
                              <div
                                className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                                style={{ background: isNew ? "rgba(255,255,255,0.015)" : "transparent" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = isNew ? "rgba(255,255,255,0.015)" : "transparent")}
                              >
                                <div className="mt-0.5 shrink-0">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      background: color,
                                      boxShadow: `0 0 6px ${color}80`,
                                      opacity: isNew ? 1 : 0.4,
                                    }}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                    <Icon className="w-3 h-3 shrink-0" style={{ color }} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                                      {n.title}
                                    </span>
                                    {isNew && (
                                      <span
                                        className="text-[9px] font-bold px-1 rounded"
                                        style={{ background: `${color}20`, color }}
                                      >
                                        nuevo
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-semibold text-white/80 truncate">{n.message}</p>
                                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{n.date}</p>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }} />
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer — email alert */}
                <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[10px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <Mail className="w-3 h-3" /> Enviar alerta por email
                  </p>
                  <div className="flex gap-1.5">
                    <input
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="director@club.com"
                      className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                      onKeyDown={e => e.key === "Enter" && emailInput && sendMutation.mutate(emailInput)}
                    />
                    <button
                      onClick={() => emailInput && sendMutation.mutate(emailInput)}
                      disabled={!emailInput || sendMutation.isPending}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1 shrink-0"
                      style={{ background: emailSent ? "rgba(192,67,43,0.15)" : "rgba(255,255,255,0.08)", color: emailSent ? "#c0432b" : "white" }}
                      aria-label="Enviar"
                    >
                      {sendMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : emailSent ? <Check className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
