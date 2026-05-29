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

        // ── Brand palette (neon green HUD) ──
        brand: {
          DEFAULT: "#00ff87",
          dim:     "#00cc6a",
          dark:    "#00994f",
          light:   "#33ffa1",
        },
        // ── Sky (secondary) ──
        sky: {
          brand: "#0ea5e9",
        },
        // Legacy alias kept so old code keeps compiling
        cyan: {
          brand: "#0ea5e9",
        },

        // ── Surfaces (deep navy) ──
        surface: {
          base: "#020817",
          0:    "#020817",
          1:    "#080f20",
          2:    "#0d1528",
          3:    "#162032",
          4:    "#1e2d40",
        },

        // ── Risk levels ──
        risk: {
          low:      "#00ff87",
          medium:   "#f59e0b",
          high:     "#f97316",
          critical: "#ff3b30",
        },

        // ── Player positions ──
        pos: {
          gk:  "#f59e0b",
          def: "#0ea5e9",
          mid: "#00ff87",
          atk: "#ff3b30",
        },

        neon: {
          DEFAULT: "#00ff87",
          dim:     "#00cc6a",
          dark:    "#00994f",
        },
      },

      backgroundImage: {
        "brand-gradient":    "linear-gradient(135deg, #00ff87 0%, #0ea5e9 100%)",
        "card-gradient":     "linear-gradient(135deg, rgba(13,21,40,0.9) 0%, rgba(8,15,32,0.95) 100%)",
        "surface-gradient":  "linear-gradient(180deg, #0d1528 0%, #080f20 100%)",
        "glow-radial-brand": "radial-gradient(ellipse at center, rgba(0,255,135,0.15) 0%, transparent 70%)",
        "glow-radial-cyan":  "radial-gradient(ellipse at center, rgba(14,165,233,0.12) 0%, transparent 70%)",
        "glow-radial-amber": "radial-gradient(ellipse at center, rgba(245,158,11,0.12) 0%, transparent 70%)",
      },

      boxShadow: {
        card:           "0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04)",
        "card-hover":   "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,135,0.15), 0 0 20px rgba(0,255,135,0.08)",
        sidebar:        "4px 0 32px rgba(0,0,0,0.6)",
        "glow-brand":   "0 0 20px rgba(0,255,135,0.25), 0 0 60px rgba(0,255,135,0.08)",
        "glow-green":   "0 0 20px rgba(0,255,135,0.25), 0 0 60px rgba(0,255,135,0.08)",
        "glow-green-sm":"0 0 10px rgba(0,255,135,0.35)",
        "glow-cyan":    "0 0 20px rgba(14,165,233,0.25)",
        "glow-blue":    "0 0 20px rgba(14,165,233,0.25)",
        "glow-red":     "0 0 20px rgba(255,59,48,0.35)",
        "glow-amber":   "0 0 20px rgba(245,158,11,0.25)",
        "glow-nav-active": "0 0 24px rgba(0,255,135,0.55), 0 0 60px rgba(0,255,135,0.18), 0 2px 8px rgba(0,0,0,0.4)",
        elevation1:     "0 2px 8px rgba(0,0,0,0.4)",
        elevation2:     "0 8px 24px rgba(0,0,0,0.5)",
        elevation3:     "0 16px 48px rgba(0,0,0,0.6)",
      },

      dropShadow: {
        "glow-brand": ["0 0 8px rgba(0,255,135,0.5)", "0 0 16px rgba(0,255,135,0.3)"],
        "glow-cyan":  ["0 0 8px rgba(14,165,233,0.5)"],
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },

      borderRadius: {
        lg:    "var(--radius)",
        md:    "calc(var(--radius) - 2px)",
        sm:    "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      letterSpacing: {
        "tightest": "-0.04em",
        "tighter":  "-0.025em",
      },

      animation: {
        "fade-in":       "fadeIn 0.4s ease-out",
        "slide-up":      "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-left": "slideInLeft 0.35s cubic-bezier(0.16,1,0.3,1)",
        "scale-in":      "scaleIn 0.25s ease-out",
        "pulse-slow":    "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        float:           "float 6s ease-in-out infinite",
        "glow-pulse":    "glowPulse 2.5s ease-in-out infinite",
        "ping-dot":      "pingDot 2s cubic-bezier(0,0,0.2,1) infinite",
        "scan-line":     "scanLine 4.5s linear infinite",
        shimmer:         "shimmer 1.8s linear infinite",
      },
      keyframes: {
        fadeIn:      { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:     { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideInLeft: { "0%": { opacity: "0", transform: "translateX(-10px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        scaleIn:     { "0%": { opacity: "0", transform: "scale(0.95)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        float:       { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        glowPulse:   { "0%,100%": { opacity: "0.5" }, "50%": { opacity: "1" } },
        pingDot:     { "75%,100%": { transform: "scale(2.2)", opacity: "0" } },
        scanLine:    { "0%": { backgroundPosition: "0% 0%" }, "100%": { backgroundPosition: "0% 100%" } },
        shimmer:     { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },

      transitionTimingFunction: {
        "spring-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "overshoot":  "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
