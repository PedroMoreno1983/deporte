import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui compatibility
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Design tokens propios
        neon: {
          DEFAULT: "#00ff87",
          dim: "#00cc6a",
          dark: "#00994f",
        },
        surface: {
          base: "#030712",
          1: "#0a0f1e",
          2: "#0f172a",
          3: "#1e293b",
          4: "#273549",
        },
        sky: { accent: "#0ea5e9" },
        risk: {
          low: "#00ff87",
          medium: "#f59e0b",
          high: "#f97316",
          critical: "#ff3b30",
        },
        position: {
          gk:  "#f59e0b",
          def: "#0ea5e9",
          mid: "#00ff87",
          atk: "#ff3b30",
        },
      },
      boxShadow: {
        "glow-green":  "0 0 20px rgba(0,255,135,0.25), 0 0 60px rgba(0,255,135,0.08)",
        "glow-green-sm": "0 0 10px rgba(0,255,135,0.35)",
        "glow-blue":   "0 0 20px rgba(14,165,233,0.25)",
        "glow-red":    "0 0 20px rgba(255,59,48,0.35)",
        "glow-amber":  "0 0 20px rgba(245,158,11,0.25)",
        "card":        "0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04)",
        "card-hover":  "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,135,0.15), 0 0 20px rgba(0,255,135,0.08)",
        "sidebar":     "4px 0 32px rgba(0,0,0,0.6)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "mesh-gradient": `radial-gradient(ellipse at 20% 50%, rgba(0,255,135,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(14,165,233,0.05) 0%, transparent 45%), radial-gradient(ellipse at 55% 90%, rgba(139,92,246,0.04) 0%, transparent 45%)`,
        "grid-pattern": `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
        "shimmer-gradient": "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
        "gk-gradient":  "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, transparent 60%)",
        "def-gradient": "linear-gradient(135deg, rgba(14,165,233,0.12) 0%, transparent 60%)",
        "mid-gradient": "linear-gradient(135deg, rgba(0,255,135,0.10) 0%, transparent 60%)",
        "atk-gradient": "linear-gradient(135deg, rgba(255,59,48,0.12) 0%, transparent 60%)",
      },
      backgroundSize: {
        "grid": "40px 40px",
      },
      animation: {
        "fade-in":     "fadeIn 0.4s ease-in-out",
        "slide-up":    "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-left": "slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "mesh-drift":  "meshDrift 20s ease infinite alternate",
        "glow-pulse":  "glowPulse 2.5s ease-in-out infinite",
        "scan-line":   "scanLine 4s linear infinite",
        "float":       "float 6s ease-in-out infinite",
        "shimmer":     "shimmer 2.2s linear infinite",
        "count-up":    "countUp 0.6s ease-out forwards",
        "ping-slow":   "ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      keyframes: {
        fadeIn:      { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:     { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideInLeft: { "0%": { opacity: "0", transform: "translateX(-12px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        meshDrift: {
          "0%":   { backgroundPosition: "0% 0%, 100% 100%, 30% 60%" },
          "100%": { backgroundPosition: "100% 50%, 0% 0%, 80% 20%" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%":      { opacity: "1",   transform: "scale(1.2)", boxShadow: "0 0 16px rgba(0,255,135,0.7)" },
        },
        scanLine: {
          "0%":   { transform: "translateY(-100%)", opacity: "0" },
          "5%":   { opacity: "0.6" },
          "95%":  { opacity: "0.6" },
          "100%": { transform: "translateY(100vh)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        countUp: {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
