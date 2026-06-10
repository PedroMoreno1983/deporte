import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LupiPalette = "terracota" | "ciruela" | "tierra";
export type LupiDensity = "compacta" | "normal" | "amplia";

export interface LupiTweaks {
  dark: boolean;
  palette: LupiPalette;
  density: LupiDensity;
  handDrawn: boolean;
  /** Text zoom, percentage (85–120). */
  fontScale: number;
}

interface TweaksStore extends LupiTweaks {
  setTweak: <K extends keyof LupiTweaks>(key: K, value: LupiTweaks[K]) => void;
  toggleDark: () => void;
  apply: () => void;
}

const DEFAULTS: LupiTweaks = {
  dark: false,
  palette: "terracota",
  density: "normal",
  handDrawn: true,
  fontScale: 100,
};

/** Push the current tweaks onto <html> as data-* attributes + CSS vars. */
function applyToRoot(t: LupiTweaks) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.setAttribute("data-theme", t.dark ? "dark" : "light");
  r.setAttribute("data-palette", t.palette);
  r.setAttribute("data-density", t.density);
  r.setAttribute("data-hand", t.handDrawn ? "on" : "off");
  r.style.setProperty("--font-scale", String((t.fontScale || 100) / 100));
}

export const useTweaksStore = create<TweaksStore>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      setTweak: (key, value) => {
        set({ [key]: value } as Pick<LupiTweaks, typeof key>);
        applyToRoot(get());
      },
      toggleDark: () => {
        set({ dark: !get().dark });
        applyToRoot(get());
      },
      apply: () => applyToRoot(get()),
    }),
    {
      name: "lupi-tweaks",
      partialize: (s): LupiTweaks => ({
        dark: s.dark,
        palette: s.palette,
        density: s.density,
        handDrawn: s.handDrawn,
        fontScale: s.fontScale,
      }),
      onRehydrateStorage: () => (state) => state?.apply(),
    }
  )
);
