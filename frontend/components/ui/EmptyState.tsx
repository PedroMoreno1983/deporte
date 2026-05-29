"use client";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyIllustration =
  | "players"
  | "injuries-ok"
  | "matches"
  | "training"
  | "notifications"
  | "wellness"
  | "data"
  | "predictions";

interface EmptyStateProps {
  illustration: EmptyIllustration;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** "compact" reduces padding for inline empty states */
  size?: "default" | "compact";
}

/**
 * Branded empty-state block with neon HUD-style SVG illustrations.
 * Use this anywhere a feature has no data yet.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
  size = "default",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "default" ? "py-12 px-6" : "py-6 px-4",
        className,
      )}
    >
      <div className="mb-5">{ILLUSTRATIONS[illustration]}</div>
      <h3 className="text-sm font-bold text-white/80">{title}</h3>
      {description && (
        <p
          className="text-xs mt-1.5 max-w-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── SVG illustrations ───────────────────────────────────────────────────
// Style: thin neon outlines on dark, subtle gradient glow under each piece.

const GLOW_FILTER = (
  <filter id="emp-glow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="2.5" result="b" />
    <feMerge>
      <feMergeNode in="b" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

function Frame({ children, glow = "#00ff87" }: { children: ReactNode; glow?: string }) {
  return (
    <div
      className="relative w-32 h-32 rounded-2xl flex items-center justify-center"
      style={{
        background: `radial-gradient(circle at 50% 60%, ${glow}10 0%, transparent 70%)`,
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          border: `1px solid ${glow}20`,
          boxShadow: `0 0 24px ${glow}10 inset`,
        }}
      />
      {children}
    </div>
  );
}

const ILLUSTRATIONS: Record<EmptyIllustration, ReactNode> = {
  /** Empty player list — silhouette over pitch */
  players: (
    <Frame>
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>{GLOW_FILTER}</defs>
        {/* mini pitch */}
        <rect x="8"  y="20" width="68" height="44" rx="4"
              stroke="rgba(0,255,135,0.25)" strokeWidth="1" fill="none" />
        <line x1="42" y1="20" x2="42" y2="64" stroke="rgba(0,255,135,0.20)" strokeWidth="0.7" />
        <circle cx="42" cy="42" r="7" stroke="rgba(0,255,135,0.20)" strokeWidth="0.7" fill="none" />
        {/* silhouette */}
        <g filter="url(#emp-glow)" stroke="#00ff87" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="42" cy="34" r="5" />
          <path d="M30 56 Q42 44 54 56 L54 60 Q42 64 30 60 Z" />
        </g>
      </svg>
    </Frame>
  ),

  /** Plantel sin lesiones — shield with check */
  "injuries-ok": (
    <Frame>
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>{GLOW_FILTER}</defs>
        <g filter="url(#emp-glow)" stroke="#00ff87" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 12 L62 20 L62 44 Q62 58 42 70 Q22 58 22 44 L22 20 Z" />
          <path d="M32 42 L40 50 L54 34" />
        </g>
        {/* HUD ticks */}
        <line x1="14" y1="20" x2="20" y2="20" stroke="rgba(0,255,135,0.4)" strokeWidth="1" />
        <line x1="64" y1="20" x2="70" y2="20" stroke="rgba(0,255,135,0.4)" strokeWidth="1" />
      </svg>
    </Frame>
  ),

  /** No matches yet */
  matches: (
    <Frame glow="#f59e0b">
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>{GLOW_FILTER}</defs>
        <g filter="url(#emp-glow)" stroke="#f59e0b" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* trophy cup */}
          <path d="M30 22 H54 V36 Q54 46 42 46 Q30 46 30 36 Z" />
          <path d="M30 28 H22 V32 Q22 38 30 38" />
          <path d="M54 28 H62 V32 Q62 38 54 38" />
          <line x1="42" y1="46" x2="42" y2="56" />
          <path d="M34 60 H50 L48 56 H36 Z" />
        </g>
      </svg>
    </Frame>
  ),

  /** No training scheduled */
  training: (
    <Frame glow="#0ea5e9">
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>{GLOW_FILTER}</defs>
        <g filter="url(#emp-glow)" stroke="#0ea5e9" strokeWidth="1.6" fill="none" strokeLinecap="round">
          {/* dumbbell */}
          <line x1="22" y1="42" x2="62" y2="42" strokeWidth="2.5" />
          <rect x="14" y="32" width="8"  height="20" rx="2" />
          <rect x="62" y="32" width="8"  height="20" rx="2" />
          <rect x="10" y="36" width="4"  height="12" rx="1" />
          <rect x="70" y="36" width="4"  height="12" rx="1" />
        </g>
      </svg>
    </Frame>
  ),

  /** Bell with no notifications */
  notifications: (
    <Frame>
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>{GLOW_FILTER}</defs>
        <g filter="url(#emp-glow)" stroke="#00ff87" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 50 Q28 32 42 30 Q56 32 56 50 L60 56 L24 56 Z" />
          <path d="M38 60 Q42 64 46 60" />
        </g>
        <circle cx="60" cy="28" r="3" fill="#00ff87" opacity="0.7" />
      </svg>
    </Frame>
  ),

  /** Wellness empty — heart pulse */
  wellness: (
    <Frame glow="#a855f7">
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>{GLOW_FILTER}</defs>
        <g filter="url(#emp-glow)" stroke="#a855f7" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 60 Q22 46 22 36 Q22 26 32 26 Q38 26 42 32 Q46 26 52 26 Q62 26 62 36 Q62 46 42 60 Z" />
          <path d="M18 42 H30 L34 36 L40 50 L46 38 L52 44 H66" stroke="#a855f7" strokeWidth="1.4" opacity="0.5" />
        </g>
      </svg>
    </Frame>
  ),

  /** Generic no-data chart */
  data: (
    <Frame>
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>{GLOW_FILTER}</defs>
        <g stroke="rgba(255,255,255,0.20)" strokeWidth="1" strokeDasharray="2 3">
          <line x1="14" y1="62" x2="70" y2="62" />
          <line x1="14" y1="14" x2="14" y2="62" />
        </g>
        <g filter="url(#emp-glow)" stroke="#00ff87" strokeWidth="1.8" fill="none" strokeLinecap="round">
          <path d="M20 50 L32 38 L44 46 L56 26 L68 32" />
          <circle cx="32" cy="38" r="2" fill="#00ff87" />
          <circle cx="44" cy="46" r="2" fill="#00ff87" />
          <circle cx="56" cy="26" r="2" fill="#00ff87" />
        </g>
      </svg>
    </Frame>
  ),

  /** Predictions empty — brain */
  predictions: (
    <Frame glow="#0ea5e9">
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>{GLOW_FILTER}</defs>
        <g filter="url(#emp-glow)" stroke="#0ea5e9" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 22 Q34 22 30 30 Q24 32 24 40 Q22 46 28 50 Q28 58 36 60 Q40 64 42 60" />
          <path d="M42 22 Q50 22 54 30 Q60 32 60 40 Q62 46 56 50 Q56 58 48 60 Q44 64 42 60" />
          <line x1="42" y1="22" x2="42" y2="60" />
          <circle cx="34" cy="36" r="1.4" fill="#0ea5e9" />
          <circle cx="50" cy="36" r="1.4" fill="#0ea5e9" />
        </g>
      </svg>
    </Frame>
  ),
};
