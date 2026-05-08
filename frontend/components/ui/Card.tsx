import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "highlight" | "danger" | "brand" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({
  children,
  className,
  variant = "default",
  padding = "md",
  hover = false,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[14px] border transition-all duration-200",
        variant === "default"   && "bg-surface-2 border-white/[0.05] shadow-card",
        variant === "highlight" && "bg-surface-2 border-white/[0.09] shadow-card-hover",
        variant === "danger"    && "bg-red-500/[0.04] border-red-500/[0.12]",
        variant === "brand"     && "bg-surface-2 border-brand/[0.15]",
        variant === "glass"     && "glass border-white/[0.06]",
        hover && "hover:shadow-card-hover hover:border-white/[0.09] hover:-translate-y-[1px]",
        padding === "none" && "",
        padding === "sm"   && "p-3",
        padding === "md"   && "p-5",
        padding === "lg"   && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
