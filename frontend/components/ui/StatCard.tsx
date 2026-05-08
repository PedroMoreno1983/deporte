"use client";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useRef, useEffect, useState } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  trend?: { value: number; label: string } | null;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "#4F8EF7",
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-[14px] border border-white/[0.05] bg-surface-2 p-5",
        "transition-all duration-200 cursor-default",
        "hover:shadow-card-hover hover:border-white/[0.09] hover:-translate-y-[1px]",
        className
      )}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)" }}
    >
      {/* Background glow */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}20 0%, transparent 70%)` }}
      />

      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <div
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
            border: `1px solid ${color}25`,
            boxShadow: `0 0 12px ${color}20`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p
            className="text-3xl font-black tabular-nums tracking-tight leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </p>
          <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            {label}
          </p>
          {trend && (
            <p
              className="text-[11px] mt-1.5 font-semibold flex items-center gap-1"
              style={{ color: trend.value >= 0 ? "var(--success)" : "var(--danger)" }}
            >
              <span>{trend.value >= 0 ? "↑" : "↓"}</span>
              {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-5 right-5 h-[1px] rounded-full opacity-30"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </div>
  );
}
