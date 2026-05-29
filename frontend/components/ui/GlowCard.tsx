"use client";
import { CSSProperties, useRef } from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/**
 * Card with mouse-tracking neon-green spotlight + lift on hover.
 * Visual rules live in `.glow-card` (globals.css). Here we only
 * wire the mouse position into the --mouse-x / --mouse-y vars
 * that the CSS radial-gradient reads.
 */
export function GlowCard({ children, className, style, onClick }: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    ref.current.style.setProperty("--mouse-x", `${x}%`);
    ref.current.style.setProperty("--mouse-y", `${y}%`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className={cn("glow-card", className)}
      style={style}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
