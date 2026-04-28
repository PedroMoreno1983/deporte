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

function SidebarContent({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const handleLogout = () => { logout(); router.push("/login"); };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-1 border-r border-white/[0.06]">
      <div className="flex items-center gap-3 px-4 py-5 shrink-0 border-b border-white/[0.06]">
        <div className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
          <Shield className="w-5 h-5 text-emerald-400" />
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
                <span className="font-black text-base tracking-tighter text-emerald-400">FC</span>
              </div>
              <p className="text-[10px] font-semibold tracking-wider uppercase text-white/30">SPORTS PLATFORM</p>
            </motion.div>
          )}
        </AnimatePresence>

        {onClose && (
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

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
                    className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/30"
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
                        "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-0.5",
                        active
                          ? "bg-emerald-500 text-black font-semibold"
                          : "text-white/50 hover:text-white hover:bg-white/[0.04]"
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
                <div className="mx-2 mt-3 h-px bg-white/[0.06]" />
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-2.5 pb-1 shrink-0">
        <NotificationBell collapsed={collapsed} />
      </div>

      <div className="p-2 shrink-0 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03]">
          <div className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
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
                <p className="text-[10px] font-medium text-emerald-400/70">
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
                className="p-1.5 rounded-lg text-white/25 hover:text-red-400 transition-colors"
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

export function Sidebar() {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 w-9 h-9 rounded-xl flex items-center justify-center bg-surface-1 border border-white/10"
          aria-label="Abrir menú"
        >
          <Menu className="w-4 h-4 text-white/70" />
        </button>

        <div className="fixed top-3 right-4 z-40">
          <div className="rounded-xl bg-surface-1 border border-white/10">
            <NotificationBell collapsed={true} />
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                className="fixed left-0 top-0 h-full z-50 w-64"
              >
                <SidebarContent collapsed={false} onClose={() => setMobileOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="relative h-screen shrink-0 z-20">
      <motion.div
        animate={{ width: collapsed ? 68 : 256 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="h-full overflow-hidden"
        style={{ willChange: "width" }}
      >
        <SidebarContent collapsed={collapsed} />
      </motion.div>

      <motion.button
        onClick={() => setCollapsed(v => !v)}
        className="absolute top-[52px] flex items-center justify-center rounded-full w-7 h-7 bg-surface-3 border border-white/10 hover:border-emerald-500/30 transition-colors"
        style={{ right: -14, zIndex: 30, cursor: "pointer" }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5 text-white/50" />
          : <ChevronLeft  className="w-3.5 h-3.5 text-white/50" />}
      </motion.button>
    </div>
  );
}
