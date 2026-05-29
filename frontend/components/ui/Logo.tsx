"use client";
import { cn } from "@/lib/utils";

type Variant = "mark" | "wordmark" | "monogram";

interface LogoProps {
  variant?: Variant;
  size?: number;
  className?: string;
  /** Disable glow / animation (for tight nav slots) */
  flat?: boolean;
}

/**
 * Deporte FC — custom shield logomark.
 * Geometric HUD-style escutcheon with diagonal slashes,
 * football-line accent and "DFC" monogram in JetBrains Mono.
 */
function Shield({ size = 40, flat = false }: { size?: number; flat?: boolean }) {
  // Base viewBox 64x72 — taller than wide to look like a shield
  return (
    <svg
      width={size}
      height={(size * 72) / 64}
      viewBox="0 0 64 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={
        flat
          ? undefined
          : {
              filter:
                "drop-shadow(0 0 6px rgba(0,255,135,0.45)) drop-shadow(0 0 16px rgba(0,255,135,0.18))",
            }
      }
    >
      <defs>
        <linearGradient id="dfc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#0d1528" />
          <stop offset="100%" stopColor="#020817" />
        </linearGradient>
        <linearGradient id="dfc-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#00ff87" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>

      {/* Outer shield — angular, cyber */}
      <path
        d="M32 2 L60 12 L60 38 Q60 56 32 70 Q4 56 4 38 L4 12 Z"
        fill="url(#dfc-fill)"
        stroke="url(#dfc-stroke)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Inner geometric slashes — HUD style */}
      <path
        d="M12 18 L24 18"
        stroke="#00ff87"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M40 18 L52 18"
        stroke="#00ff87"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Football laces — subtle diagonal */}
      <path
        d="M22 50 L42 50 M24 54 L40 54 M26 58 L38 58"
        stroke="#0ea5e9"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Monogram DFC */}
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="14"
        fontWeight="900"
        letterSpacing="0.5"
        fill="#00ff87"
        style={{ filter: flat ? undefined : "drop-shadow(0 0 4px rgba(0,255,135,0.6))" }}
      >
        DFC
      </text>

      {/* Bottom accent point */}
      <circle cx="32" cy="64" r="1.4" fill="#00ff87" />
    </svg>
  );
}

export function Logo({ variant = "mark", size = 36, className, flat = false }: LogoProps) {
  if (variant === "mark") {
    return (
      <div className={cn("inline-flex items-center justify-center", className)}>
        <Shield size={size} flat={flat} />
      </div>
    );
  }

  if (variant === "monogram") {
    // Compact square — for favicon-like contexts
    return (
      <div
        className={cn("inline-flex items-center justify-center rounded-xl", className)}
        style={{
          width: size,
          height: size,
          background:
            "linear-gradient(135deg, rgba(0,255,135,0.20) 0%, rgba(0,255,135,0.06) 100%)",
          border: "1px solid rgba(0,255,135,0.40)",
          boxShadow: flat ? "none" : "0 0 16px rgba(0,255,135,0.30)",
        }}
      >
        <Shield size={Math.max(18, size * 0.65)} flat={flat} />
      </div>
    );
  }

  // wordmark: shield + DEPORTE FC text
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <Shield size={size} flat={flat} />
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-1">
          <span
            className="font-black tracking-tight text-white"
            style={{ fontSize: size * 0.42 }}
          >
            DEPORTE
          </span>
          <span
            className="font-black tracking-tight"
            style={{ fontSize: size * 0.42, color: "#00ff87" }}
          >
            FC
          </span>
        </div>
        <span
          className="font-bold uppercase mt-1"
          style={{
            fontSize: Math.max(8, size * 0.22),
            letterSpacing: "0.18em",
            color: "rgba(0,255,135,0.55)",
          }}
        >
          Sports Platform
        </span>
      </div>
    </div>
  );
}
