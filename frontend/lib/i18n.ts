"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import pt from "@/messages/pt.json";

export const LOCALES = ["es", "en", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, { name: string; flag: string }> = {
  es: { name: "Español",    flag: "🇪🇸" },
  en: { name: "English",    flag: "🇬🇧" },
  pt: { name: "Português",  flag: "🇧🇷" },
};

const MESSAGES: Record<Locale, any> = { es, en, pt };

interface LocaleStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: "es",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "deporte-locale" },
  ),
);

/** Get all messages for the current locale (for NextIntlClientProvider). */
export function getMessages(locale: Locale) {
  return MESSAGES[locale] ?? MESSAGES.es;
}

/** Detect browser locale (fallback to "es"). */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "es";
  const browser = (navigator.language || "es").slice(0, 2).toLowerCase();
  return (LOCALES as readonly string[]).includes(browser) ? (browser as Locale) : "es";
}
