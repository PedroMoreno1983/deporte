"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, AlertTriangle, Trophy,
  Dumbbell, Brain, Settings, ChevronLeft, ChevronRight,
  LogOut, BarChart3, Map, HeartPulse, Menu, X, CalendarDays,
  GitCompare, Video, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { useState, useEffect } from "react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { Logo } from "@/components/ui/Logo";
import { useQuery } from "@tanstack/react-query";
import { clubsApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";

const NAV_GROUPS = [
  {
    labelKey: "nav.general",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard",   roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/players",   icon: Users,           labelKey: "nav.players",     roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/injuries",  icon: AlertTriangle,   labelKey: "nav.injuries",    roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/matches",   icon: Trophy,          labelKey: "nav.matches",     roles: ["admin", "coach", "analyst"] },
      { href: "/training",  icon: Dumbbell,        labelKey: "nav.training",    roles: ["admin", "coach", "kinesiologist"] },
      { href: "/tactical",  icon: Map,             labelKey: "nav.tactical",    roles: ["admin", "coach", "analyst"] },
      { href: "/calendar",  icon: CalendarDays,    labelKey: "nav.calendar",    roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/wellness",  icon: HeartPulse,      labelKey: "nav.wellness",    roles: ["admin", "coach", "kinesiologist"] },
    ],
  },
  {
    labelKey: "nav.analytics_group",
    items: [
      { href: "/agent",           icon: Bot,        labelKey: "nav.agent",        roles: ["admin", "analyst", "coach", "kinesiologist"] },
      { href: "/analytics",       icon: BarChart3,  labelKey: "nav.analytics",    roles: ["admin", "analyst", "coach"] },
      { href: "/players/compare", icon: GitCompare, labelKey: "nav.compare",      roles: ["admin", "analyst", "coach"] },
      { href: "/predictions",     icon: Brain,      labelKey: "nav.predictions",  roles: ["admin", "analyst"] },
      { href: "/cv",              icon: Video,      labelKey: "nav.cv",           roles: ["admin", "analyst", "coach"] },
    ],
  },
  {
    labelKey: "nav.system",
    items: [
      { href: "/settings", icon: Settings, labelKey: "nav.settings", roles: ["admin"] },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  admin:         "#A855F7",
  coach:         "#00FF87",
  kinesiologist: "#0EA5E9",
  analyst:       "#F59E0B",
};

function SidebarContent({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();
  const t = useTranslations();

  const { data: club } = useQuery({
    queryKey: ["my-club"],
    queryFn:  clubsApi.me,
    enabled:  !!user?.club_id,
    staleTime: 60 * 60 * 1000,
  });

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const handleLogout = () => { logout(); router.push("/login"); };

  const roleColor = ROLE_COLORS[user?.role ?? ""] ?? "#00FF87";

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: "var(--surface-1)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5 shrink-0 relative"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {/* Neon top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,255,135,0.6), transparent)",
          }}
        />
        <Logo variant="mark" size={36} flat />

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden flex-1 min-w-0"
            >
              <div className="flex items-baseline gap-0.5">
                <span className="font-black text-[15px] tracking-tight text-white">DEPORTE</span>
                <span
                  className="font-black text-[15px] tracking-tight"
                  style={{ color: "var(--brand)" }}
                >
                  FC
                </span>
              </div>
              <p
                className="text-[9px] font-bold tracking-[0.18em] uppercase truncate"
                style={{ color: "rgba(0,255,135,0.55)" }}
              >
                {(club as any)?.name ?? t("logo.tagline")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav data-tour-id="sidebar-nav" className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
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
                    className="px-2 pb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t(group.labelKey as any)}
                  </motion.p>
                )}
              </AnimatePresence>

              {visible.map(item => {
                const active = isActive(item.href);
                const label = t(item.labelKey as any);
                return (
                  <Link key={item.href} href={item.href} title={collapsed ? label : undefined}>
                    <div
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 mb-0.5",
                        active ? "font-bold" : "font-medium hover:text-white/80"
                      )}
                      style={
                        active
                          ? {
                              background: "var(--color-neon)",
                              color: "#020817",
                              boxShadow: "var(--glow-nav-active)",
                            }
                          : { color: "var(--text-muted)" }
                      }
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <item.icon
                        className="w-[18px] h-[18px] shrink-0"
                        style={{ color: active ? "#020817" : undefined }}
                      />

                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -4 }}
                            transition={{ duration: 0.14 }}
                            className="whitespace-nowrap"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </Link>
                );
              })}

              {gi < NAV_GROUPS.length - 1 && (
                <div
                  className="mx-2 mt-3 h-px"
                  style={{ background: "var(--border-subtle)" }}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* Notification bell + locale switcher */}
      <div className="px-2 pb-1 shrink-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <NotificationBell collapsed={collapsed} />
        </div>
        {!collapsed && <LocaleSwitcher />}
      </div>

      {/* User footer */}
      <div
        className="p-2 shrink-0"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black"
            style={{
              background: `linear-gradient(135deg, ${roleColor}20 0%, ${roleColor}08 100%)`,
              border: `1px solid ${roleColor}30`,
              color: roleColor,
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
                <p
                  className="text-[10px] font-semibold"
                  style={{ color: roleColor }}
                >
                  {user?.role ? t(`roles.${user.role}` as any) : ""}
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
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
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
          className="fixed top-4 left-4 z-40 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-medium)",
          }}
          aria-label="Abrir menú"
        >
          <Menu className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
        </button>

        <div className="fixed top-3 right-4 z-40">
          <div
            className="rounded-xl"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-medium)" }}
          >
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
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
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
        className="absolute top-[52px] flex items-center justify-center rounded-full w-6 h-6 transition-all"
        style={{
          right: -12,
          zIndex: 30,
          cursor: "pointer",
          background: "var(--surface-3)",
          border: "1px solid var(--border-medium)",
        }}
        whileHover={{ scale: 1.15, borderColor: "var(--brand)" }}
        whileTap={{ scale: 0.9 }}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          : <ChevronLeft  className="w-3 h-3" style={{ color: "var(--text-muted)" }} />}
      </motion.button>
    </div>
  );
}
