"use client";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Globe } from "lucide-react";
import { useLocaleStore, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

interface LocaleSwitcherProps {
  compact?: boolean;
}

const MENU_WIDTH = 170;
const MENU_GAP   = 8;

export function LocaleSwitcher({ compact = false }: LocaleSwitcherProps) {
  const { locale, setLocale } = useLocaleStore();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const compute = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuH = 48 + LOCALES.length * 36; // approx
      // prefer above the button if there's room, else below
      const above = r.top - menuH - MENU_GAP > 8;
      const top = above
        ? r.top - menuH - MENU_GAP
        : Math.min(r.bottom + MENU_GAP, vh - menuH - 8);
      // align right-edge to button right when possible
      const left = Math.max(8, Math.min(r.right - MENU_WIDTH, vw - MENU_WIDTH - 8));
      setPos({ left, top });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  const current = LOCALE_LABELS[locale];

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors"
        style={{
          background: open ? "rgba(192,67,43,0.10)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${open ? "rgba(192,67,43,0.30)" : "rgba(255,255,255,0.08)"}`,
          color: open ? "#c0432b" : "rgba(255,255,255,0.65)",
        }}
        aria-label="Idioma"
        aria-expanded={open}
        title="Idioma"
      >
        <Globe className="w-3.5 h-3.5 shrink-0" />
        {!compact && (
          <>
            <span className="text-xs font-bold uppercase">{locale}</span>
            <span className="text-sm leading-none">{current.flag}</span>
          </>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="fixed z-[60] rounded-xl overflow-hidden"
                style={{
                  left:  pos.left,
                  top:   pos.top,
                  width: MENU_WIDTH,
                  background: "rgba(8,15,32,0.96)",
                  backdropFilter: "blur(20px) saturate(180%)",
                  border: "1px solid rgba(192,67,43,0.25)",
                  boxShadow:
                    "0 12px 32px rgba(0,0,0,0.6), 0 0 16px rgba(192,67,43,0.15)",
                }}
              >
                {LOCALES.map((l) => {
                  const info = LOCALE_LABELS[l as Locale];
                  const active = l === locale;
                  return (
                    <button
                      key={l}
                      onClick={() => { setLocale(l as Locale); setOpen(false); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.05]"
                      style={{ color: active ? "#c0432b" : "rgba(255,255,255,0.8)" }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none">{info.flag}</span>
                        <span className="font-semibold truncate">{info.name}</span>
                      </span>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
