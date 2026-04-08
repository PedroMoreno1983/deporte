"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, AlertTriangle, Trophy,
  Dumbbell, Brain, Settings, ChevronLeft, ChevronRight,
  LogOut, BarChart3, Shield, Map, HeartPulse, Menu, X, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { useState, useEffect } from "react";
import { NotificationBell } from "@/components/ui/NotificationBell";

const NAV_GROUPS = [
  {
    label: "General",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard",     roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/players",   icon: Users,           label: "Jugadores",     roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/injuries",  icon: AlertTriangle,   label: "Lesiones",      roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/matches",   icon: Trophy,          label: "Partidos",      roles: ["admin", "coach", "analyst"] },
      { href: "/training",  icon: Dumbbell,        label: "Entrenamiento", roles: ["admin", "coach", "kinesiologist"] },
      { href: "/tactical",  icon: Map,             label: "Pizarra",       roles: ["admin", "coach", "analyst"] },
      { href: "/calendar",  icon: CalendarDays,    label: "Calendario",    roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/wellness",  icon: HeartPulse,      label: "Wellness",      roles: ["admin", "coach", "kinesiologist"] },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/analytics",   icon: BarChart3, label: "Analytics",    roles: ["admin", "analyst", "coach"] },
      { href: "/predictions", icon: Brain,     label: "Predicciones", roles: ["admin", "analyst"] },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/settings", icon: Settings, label: "Configuración", roles: ["admin"] },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin:         "Administrador",
  coach:         "Entrenador",
  kinesiologist: "Kinesiólogo",
  analyst:       "Analista",
};

// ─── Inner sidebar content (shared between desktop & mobile drawer) ────────────
function SidebarContent({
  collapsed,
  onClose,
}: {
  collapsed: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const handleLogout = () => { logout(); router.push("/login"); };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: "var(--surface-1)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "4px 0 40px rgba(0,0,0,0.7)",
        position: "relative",
      }}
    >
      {/* Top neon accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(0,255,135,0.6), transparent)" }}
      />

      {/* ── Logo ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(0,255,135,0.20), rgba(0,255,135,0.08))",
            border: "1px solid rgba(0,255,135,0.40)",
            boxShadow: "0 0 16px rgba(0,255,135,0.30), 0 0 40px rgba(0,255,135,0.10)",
          }}
        >
          <Shield className="w-5 h-5" style={{ color: "#00ff87" }} />
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden flex-1 min-w-0"
            >
              <div className="flex items-baseline gap-1">
                <span className="font-black text-base tracking-tighter text-white">DEPORTE</span>
                <span className="font-black text-base tracking-tighter" style={{ color: "#00ff87" }}>FC</span>
              </div>
              <p className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: "rgba(0,255,135,0.55)" }}>
                SPORTS PLATFORM
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "white")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {NAV_GROUPS.map((group, gi) => {
          const visible = group.items.filter(item =>
            user?.role ? item.roles.includes(user.role) : false
          );
          if (!visible.length) return null;

          return (
            <div key={gi} className={gi > 0 ? "pt-3" : ""}>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-2 pb-2 text-[9px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: "rgba(100,116,139,0.8)" }}
                  >
                    {group.label}
                  </motion.p>
                )}
              </AnimatePresence>

              {visible.map(item => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
                    <div
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 mb-0.5",
                        active
                          ? "nav-pill-active"
                          : "text-white/40 hover:text-white/80 hover:bg-white/[0.05]"
                      )}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />
                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -4 }}
                            transition={{ duration: 0.14 }}
                            className="whitespace-nowrap font-medium"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </Link>
                );
              })}

              {gi < NAV_GROUPS.length - 1 && (
                <div className="mx-2 mt-3 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Notifications ──────────────────────────────────── */}
      <div className="px-2.5 pb-1 shrink-0">
        <NotificationBell collapsed={collapsed} />
      </div>

      {/* ── User card ──────────────────────────────────────── */}
      <div
        className="p-2 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div
            className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-black"
            style={{
              background: "linear-gradient(135deg, rgba(0,255,135,0.20), rgba(0,255,135,0.08))",
              border: "1px solid rgba(0,255,135,0.35)",
              color: "#00ff87",
              boxShadow: "0 0 12px rgba(0,255,135,0.20)",
            }}
          >
            {user?.full_name?.charAt(0) ?? "U"}
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-bold text-white/85 truncate">{user?.full_name}</p>
                <p className="text-[10px] font-semibold" style={{ color: "rgba(0,255,135,0.75)" }}>
                  {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.25)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ff3b30")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Main Sidebar export ──────────────────────────────────────────────────────
export function Sidebar() {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);
  const pathname = usePathname();

  // Detect breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // ── Mobile: hamburger + overlay drawer ──────────────────
  if (isMobile) {
    return (
      <>
        {/* Hamburger button fixed top-left */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{
            background: "var(--surface-1)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
          aria-label="Abrir menú"
        >
          <Menu className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }} />
        </button>

        {/* Notification bell fixed top-right on mobile */}
        <div className="fixed top-3 right-4 z-40">
          <div
            className="rounded-xl overflow-visible"
            style={{
              background: "var(--surface-1)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            }}
          >
            <NotificationBell collapsed={true} />
          </div>
        </div>

        {/* Overlay + Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50"
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
                onClick={() => setMobileOpen(false)}
              />

              {/* Drawer */}
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                className="fixed left-0 top-0 h-full z-50"
                style={{ width: 256 }}
              >
                <SidebarContent collapsed={false} onClose={() => setMobileOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── Desktop: persistent sidebar + collapse button ────────
  return (
    <div className="relative h-screen shrink-0" style={{ zIndex: 20 }}>
      {/* Animated width wrapper */}
      <motion.div
        animate={{ width: collapsed ? 68 : 256 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="h-full overflow-hidden"
        style={{ willChange: "width" }}
      >
        <SidebarContent collapsed={collapsed} />
      </motion.div>

      {/* Collapse toggle — outside overflow-hidden so it renders correctly */}
      <motion.button
        onClick={() => setCollapsed(v => !v)}
        className="absolute top-[52px] flex items-center justify-center rounded-full"
        style={{
          right: -14,
          width: 28,
          height: 28,
          background: "var(--surface-3)",
          border: "1px solid rgba(0,255,135,0.25)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.5), 0 0 8px rgba(0,255,135,0.12)",
          zIndex: 30,
          cursor: "pointer",
        }}
        whileHover={{ scale: 1.15, boxShadow: "0 2px 16px rgba(0,0,0,0.6), 0 0 16px rgba(0,255,135,0.25)" }}
        whileTap={{ scale: 0.92 }}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(0,255,135,0.7)" }} />
          : <ChevronLeft  className="w-3.5 h-3.5" style={{ color: "rgba(0,255,135,0.7)" }} />}
      </motion.button>
    </div>
  );
}
