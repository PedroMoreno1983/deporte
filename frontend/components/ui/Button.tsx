"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "text-black font-bold " +
    "bg-[#00ff87] hover:bg-[#00cc6a] active:bg-[#00994f] " +
    "shadow-[0_0_20px_rgba(0,255,135,0.35)] hover:shadow-[0_0_28px_rgba(0,255,135,0.50)] " +
    "transition-all duration-200",
  secondary:
    "text-white/80 font-medium " +
    "bg-white/[0.06] hover:bg-white/[0.10] " +
    "border border-white/10 hover:border-white/20 " +
    "transition-all duration-150",
  danger:
    "text-[#ff3b30] font-semibold " +
    "bg-[rgba(255,59,48,0.12)] hover:bg-[rgba(255,59,48,0.20)] " +
    "border border-[rgba(255,59,48,0.30)] hover:border-[rgba(255,59,48,0.50)] " +
    "shadow-[0_0_12px_rgba(255,59,48,0)] hover:shadow-[0_0_16px_rgba(255,59,48,0.25)] " +
    "transition-all duration-150",
  ghost:
    "text-white/50 font-medium " +
    "hover:text-white/90 hover:bg-white/[0.05] " +
    "transition-all duration-150",
  outline:
    "text-[#00ff87] font-semibold " +
    "bg-transparent hover:bg-[rgba(0,255,135,0.08)] " +
    "border border-[rgba(0,255,135,0.30)] hover:border-[rgba(0,255,135,0.55)] " +
    "transition-all duration-150",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg  gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl  gap-2",
  lg: "px-5 py-3   text-sm rounded-xl  gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap select-none",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin w-3.5 h-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
