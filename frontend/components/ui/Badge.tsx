import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG,
  RISK_COLORS,
  RISK_LABELS,
  ROLE_COLORS,
  ROLE_LABELS,
  POSITION_COLORS,
  POSITION_BADGE_LABELS,
  POSITION_GROUPS,
} from "@/lib/colors";

// ── Generic badge ────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color = "#00ff87", className }: BadgeProps) {
  return (
    <span
      className={cn("badge", className)}
      style={{
        color,
        background: `${color}20`,
        border: `1px solid ${color}4d`,
      }}
    >
      {children}
    </span>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps { status: string; className?: string }

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;
  return (
    <span
      className={cn("badge", className)}
      style={{
        color:      cfg.color,
        background: cfg.bg,
        border:     `1px solid ${cfg.border}`,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ── Risk badge ───────────────────────────────────────────────────────────────

interface RiskBadgeProps { level: string; className?: string }

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const color = RISK_COLORS[level] ?? "#64748b";
  const label = RISK_LABELS[level] ?? level;
  return (
    <span
      className={cn("badge", className)}
      style={{
        color,
        background: `${color}20`,
        border: `1px solid ${color}40`,
      }}
    >
      ● {label}
    </span>
  );
}

// ── Position badge ───────────────────────────────────────────────────────────

interface PositionBadgeProps { position: string; className?: string }

export function PositionBadge({ position, className }: PositionBadgeProps) {
  const group = POSITION_GROUPS[position] ?? "mid";
  const color = POSITION_COLORS[group];
  const label = POSITION_BADGE_LABELS[group];
  return (
    <span
      className={cn("badge rounded-md tracking-widest font-black", className)}
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        letterSpacing: "0.10em",
      }}
    >
      {label}
    </span>
  );
}

// ── Role badge ───────────────────────────────────────────────────────────────

interface RoleBadgeProps { role: string; className?: string }

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const color = ROLE_COLORS[role] ?? "#64748b";
  const label = ROLE_LABELS[role]  ?? role;
  return (
    <span
      className={cn("badge", className)}
      style={{
        color,
        background: `${color}20`,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  );
}
