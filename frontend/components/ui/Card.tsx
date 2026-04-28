import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "highlight" | "danger";
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className, variant = "default", padding = "md" }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        variant === "default" && "bg-surface-2/60 border-white/[0.06] shadow-card",
        variant === "highlight" && "bg-surface-2/80 border-white/[0.08] shadow-card-hover",
        variant === "danger" && "bg-red-500/[0.03] border-red-500/10",
        padding === "none" && "",
        padding === "sm" && "p-3",
        padding === "md" && "p-5",
        padding === "lg" && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
