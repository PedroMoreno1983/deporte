import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconColor?: string;
  iconBg?: string;
  badge?: string;
  badgeColor?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  icon: Icon, title, description, iconColor = "text-neon", iconBg = "bg-neon/10 border-neon/20",
  badge, badgeColor = "text-neon bg-neon/10 border-neon/20", action, className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 mb-6", className)}>
      <div className="flex items-center gap-4">
        <div className={cn("p-3 rounded-xl border", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {badge && (
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", badgeColor)}>
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-white/40 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
