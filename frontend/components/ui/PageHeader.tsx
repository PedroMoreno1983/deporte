import { cn } from "@/lib/utils";
import { ReactNode, type ComponentType } from "react";
import { type LucideProps } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  icon?: ComponentType<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  iconColor?: string;
  iconBg?: string;
  badge?: string;
  badgeColor?: string;
  description?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
  icon: Icon,
  iconColor,
  iconBg,
  badge,
  badgeColor,
  description,
}: PageHeaderProps) {
  const displaySubtitle = subtitle ?? description;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                iconBg ?? "bg-surface-3 border-white/[0.07]"
              )}
            >
              <Icon className={cn("w-4 h-4", iconColor ?? "text-white/30")} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-white leading-tight">
                {title}
              </h1>
              {badge && (
                <span
                  className={cn(
                    "inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    badgeColor ?? "bg-surface-3 border-white/[0.07] text-white/30"
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
            {displaySubtitle && (
              <p className="text-sm mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
                {displaySubtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Decorative underline */}
      <div
        className="h-px w-full mt-4"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,255,135,0.45) 0%, rgba(14,165,233,0.18) 30%, transparent 70%)",
        }}
      />
    </div>
  );
}
