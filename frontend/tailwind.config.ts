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
        // Brand palette
        brand: {
          DEFAULT: "#4F8EF7",
          dark: "#3B6FD4",
          light: "#7AACFA",
        },
        cyan: {
          brand: "#00D4FF",
        },
        // Surfaces — deep navy
        surface: {
          base: "#03070F",
          1:    "#070D1A",
          2:    "#0C1526",
          3:    "#111D33",
          4:    "#1A2A45",
        },
      },
      backgroundImage: {
        "brand-gradient":   "linear-gradient(135deg, #4F8EF7 0%, #00D4FF 100%)",
        "card-gradient":    "linear-gradient(135deg, rgba(12,21,38,0.9) 0%, rgba(7,13,26,0.95) 100%)",
        "surface-gradient": "linear-gradient(180deg, #0C1526 0%, #070D1A 100%)",
        "glow-radial-brand": "radial-gradient(ellipse at center, rgba(79,142,247,0.15) 0%, transparent 70%)",
        "glow-radial-cyan":  "radial-gradient(ellipse at center, rgba(0,212,255,0.12) 0%, transparent 70%)",
      },
      boxShadow: {
        card:         "0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-hover": "0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)",
        "glow-brand": "0 0 20px rgba(79,142,247,0.35), 0 0 40px rgba(79,142,247,0.15)",
        "glow-sm-brand": "0 0 12px rgba(79,142,247,0.3)",
        "glow-cyan":  "0 0 20px rgba(0,212,255,0.25)",
        "glow-red":   "0 0 20px rgba(239,68,68,0.25)",
        elevation1:   "0 2px 8px rgba(0,0,0,0.4)",
        elevation2:   "0 8px 24px rgba(0,0,0,0.5)",
        elevation3:   "0 16px 48px rgba(0,0,0,0.6)",
      },
      dropShadow: {
        "glow-brand": ["0 0 8px rgba(79,142,247,0.5)", "0 0 16px rgba(79,142,247,0.3)"],
        "glow-cyan":  ["0 0 8px rgba(0,212,255,0.5)"],
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-out",
        "slide-up":   "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-left": "slideInLeft 0.35s cubic-bezier(0.16,1,0.3,1)",
        "scale-in":   "scaleIn 0.25s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        float:        "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:     { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:    { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideInLeft:{ "0%": { opacity: "0", transform: "translateX(-10px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        scaleIn:    { "0%": { opacity: "0", transform: "scale(0.95)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        float:      { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
