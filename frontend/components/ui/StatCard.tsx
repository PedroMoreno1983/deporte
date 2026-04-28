import { cn } from "@/lib/utils";
import { Card } from "./Card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  trend?: { value: number; label: string } | null;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, color = "#10b981", trend, className }: StatCardProps) {
  return (
    <Card className={cn("flex items-center gap-4", className)}>
      <div
        className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}14`, color }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-xs text-white/40 mt-0.5">{label}</p>
        {trend && (
          <p className="text-[11px] mt-1 font-medium" style={{ color: trend.value >= 0 ? "#10b981" : "#ef4444" }}>
            {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
          </p>
        )}
      </div>
    </Card>
  );
}
