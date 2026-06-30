"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/store";
import { useTweaksStore } from "@/lib/theme-store";
import { clubsApi } from "@/lib/api";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { Note } from "@/components/lupi/primitives";

type NavItem = { href: string; labelKey: string; roles: string[] };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "el día a día",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/players",   labelKey: "nav.players",   roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/injuries",  labelKey: "nav.injuries",  roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/matches",   labelKey: "nav.matches",   roles: ["admin", "coach", "analyst"] },
      { href: "/training",  labelKey: "nav.training",  roles: ["admin", "coach", "kinesiologist"] },
      { href: "/tactical",  labelKey: "nav.tactical",  roles: ["admin", "coach", "analyst"] },
      { href: "/calendar",  labelKey: "nav.calendar",  roles: ["admin", "coach", "kinesiologist", "analyst"] },
      { href: "/wellness",  labelKey: "nav.wellness",  roles: ["admin", "coach", "kinesiologist"] },
    ],
  },
  {
    label: "lectura de datos",
    items: [
      { href: "/agent",           labelKey: "nav.agent",       roles: ["admin", "analyst", "coach", "kinesiologist"] },
      { href: "/analytics",       labelKey: "nav.analytics",   roles: ["admin", "analyst", "coach"] },
      { href: "/players/compare", labelKey: "nav.compare",     roles: ["admin", "analyst", "coach"] },
      { href: "/predictions",     labelKey: "nav.predictions", roles: ["admin", "analyst"] },
      { href: "/cv",              labelKey: "nav.cv",          roles: ["admin", "analyst", "coach"] },
      { href: "/video-lab",       labelKey: "nav.video_lab",   roles: ["admin", "analyst", "coach"] },
    ],
  },
  {
    label: "sistema",
    items: [
      { href: "/settings", labelKey: "nav.settings", roles: ["admin"] },
    ],
  },
];

const ALL_HREFS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));

/** The single active nav href = the longest one matching the pathname. */
function activeHref(pathname: string): string {
  let best = "";
  for (const href of ALL_HREFS) {
    if ((pathname === href || pathname.startsWith(href + "/")) && href.length > best.length) {
      best = href;
    }
  }
  return best;
}

function NavMark({ active }: { active: boolean }) {
  return (
    <svg width={16} height={16} className="nav-mark" aria-hidden="true">
      <circle cx={8} cy={8} r={5} fill={active ? "var(--terracotta)" : "none"}
        stroke={active ? "var(--terracotta)" : "var(--ink-faint)"} strokeWidth={1.5} filter="url(#wobble)" />
    </svg>
  );
}

function ThemeToggle() {
  const dark = useTweaksStore((s) => s.dark);
  const toggleDark = useTweaksStore((s) => s.toggleDark);
  return (
    <button className="theme-toggle" onClick={toggleDark} title={dark ? "Modo claro" : "Lupi nocturno"} aria-label="Cambiar tema">
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const t = useTranslations();
  const active = activeHref(pathname);

  const { data: club } = useQuery({
    queryKey: ["my-club"],
    queryFn: clubsApi.me,
    enabled: !!user?.club_id,
    staleTime: 60 * 60 * 1000,
  });

  const handleLogout = () => { logout(); router.push("/login"); };
  const clubName = (club as { name?: string } | undefined)?.name;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <svg width={40} height={40} viewBox="0 0 40 40">
            <circle cx={20} cy={20} r={16} fill="none" stroke="var(--ink)" strokeWidth={1.6} filter="url(#wobble)" />
            <circle cx={20} cy={20} r={6} fill="var(--terracotta)" filter="url(#wobble)" />
          </svg>
        </div>
        <div>
          <div className="brand-name">Deporte <span className="brand-fc">FC</span></div>
          <Note style={{ fontSize: 14 }}>{clubName ?? "cuaderno del cuerpo técnico"}</Note>
        </div>
      </div>

      <nav className="nav">
        {NAV_GROUPS.map((g) => {
          const visible = g.items.filter((it) => (user?.role ? it.roles.includes(user.role) : false));
          if (!visible.length) return null;
          return (
            <div className="nav-group" key={g.label}>
              <div className="nav-group-label">{g.label}</div>
              {visible.map((it) => {
                const isActive = active === it.href;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={"nav-item" + (isActive ? " is-active" : "")}
                    onClick={onNavigate}
                  >
                    <NavMark active={isActive} />
                    <span className="nav-label">{t(it.labelKey as never)}</span>
                    {isActive && <span className="nav-active-line" />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--rule)" }}>
        <div className="flex-1 min-w-0"><NotificationBell collapsed={false} /></div>
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="user-foot">
        <div className="user-avatar">{user?.full_name?.charAt(0) ?? "U"}</div>
        <div className="user-info" style={{ flex: 1 }}>
          <div className="user-name">{user?.full_name ?? "Usuario"}</div>
          <Note style={{ fontSize: 13 }}>{user?.role ? t(`roles.${user.role}` as never) : ""}</Note>
        </div>
        <button
          onClick={handleLogout}
          className="theme-toggle"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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
          className="fixed top-4 left-4 z-40 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "var(--paper-card)", border: "1.5px solid var(--rule)", color: "var(--ink-soft)" }}
          aria-label="Abrir menú"
        >
          <Menu className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40"
                style={{ background: "rgba(44,38,32,0.4)", backdropFilter: "blur(2px)" }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                className="fixed left-0 top-0 h-full z-50"
              >
                <button
                  onClick={() => setMobileOpen(false)}
                  className="absolute top-5 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ color: "var(--ink-faint)" }}
                  aria-label="Cerrar menú"
                >
                  <X className="w-4 h-4" />
                </button>
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return <SidebarContent />;
}
