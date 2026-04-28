import { cn } from "@/lib/utils";
import { getStatusConfig, getRiskConfig, getPositionConfig, getRoleConfig } from "@/lib/design-system";

type BadgeVariant = "status" | "risk" | "position" | "role";

interface BadgeProps {
  variant: BadgeVariant;
  value: string | null | undefined;
  className?: string;
}

export function Badge({ variant, value, className }: BadgeProps) {
  let config;
  switch (variant) {
    case "status":
      config = getStatusConfig(value);
      break;
    case "risk":
      config = getRiskConfig(value);
      break;
    case "position":
      config = getPositionConfig(value);
      break;
    case "role":
      config = getRoleConfig(value);
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border",
        config.twBg,
        (config as any).twBorder,
        config.twText,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  );
}
