"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { notificationsApi, alertsApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertTriangle, Heart, Shield, X, ChevronRight, Mail, Loader2, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
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
  baja:    "#00ff87",
};

export function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [emailInput, setEmailInput] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: 5 * 60 * 1000, // every 5 min
    staleTime: 60 * 1000,
  });

  const unread = notifications.filter((n) => !read.has(n.id));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = () => setRead(new Set(notifications.map((n) => n.id)));

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-2 p-2 rounded-xl transition-all duration-150"
        style={{
          color: open ? "#00ff87" : "rgba(255,255,255,0.45)",
          background: open ? "rgba(0,255,135,0.08)" : "transparent",
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

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
            style={{
              width: 320,
              background: "var(--surface-2, #111827)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5" style={{ color: "var(--neon, #00ff87)" }} />
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
              <div className="flex items-center gap-2">
                {unread.length > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] font-semibold transition-colors"
                    style={{ color: "var(--neon, #00ff87)" }}
                  >
                    Marcar leídas
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div
                    className="p-3 rounded-xl"
                    style={{ background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.15)" }}
                  >
                    <Bell className="w-5 h-5" style={{ color: "var(--neon, #00ff87)" }} />
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
                        transition={{ delay: i * 0.03 }}
                      >
                        <Link
                          href={`/players/${n.player_id}`}
                          onClick={() => {
                            setRead((prev) => new Set([...prev, n.id]));
                            setOpen(false);
                          }}
                        >
                          <div
                            className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                            style={{ background: isNew ? "rgba(255,255,255,0.015)" : "transparent" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = isNew ? "rgba(255,255,255,0.015)" : "transparent")}
                          >
                            {/* Severity dot */}
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

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
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
            <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                <Mail className="w-3 h-3" /> Enviar alerta por email
              </p>
              <div className="flex gap-1.5">
                <input
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="director@club.com"
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                  onKeyDown={e => e.key === "Enter" && emailInput && sendMutation.mutate(emailInput)}
                />
                <button
                  onClick={() => emailInput && sendMutation.mutate(emailInput)}
                  disabled={!emailInput || sendMutation.isPending}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1"
                  style={{ background: emailSent ? "rgba(0,255,135,0.15)" : "rgba(255,255,255,0.08)", color: emailSent ? "#00ff87" : "white" }}
                >
                  {sendMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : emailSent ? <Check className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
