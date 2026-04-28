import { cn } from "@/lib/utils";
import { ReactNode, type ComponentType } from "react";
import { type LucideProps } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  // Legacy props for backward compatibility
  icon?: ComponentType<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  iconColor?: string;
  iconBg?: string;
  badge?: string;
  badgeColor?: string;
  description?: string;
}

export function PageHeader({ title, subtitle, action, className, icon: Icon, iconColor, iconBg, badge, badgeColor, description }: PageHeaderProps) {
  const displaySubtitle = subtitle ?? description;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            iconBg ? iconBg : "bg-white/[0.03] border border-white/[0.06]"
          )}>
            <Icon className={cn("w-4 h-4", iconColor ?? "text-white/30")} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
          {displaySubtitle && <p className="text-sm text-white/40 mt-0.5">{displaySubtitle}</p>}
          {badge && (
            <span className={cn(
              "inline-flex mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border",
              badgeColor ? badgeColor : "bg-white/[0.03] border-white/[0.06] text-white/30"
            )}>
              {badge}
            </span>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
