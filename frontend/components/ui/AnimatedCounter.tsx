"use client";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
}

export function AnimatedCounter({
  value, duration = 1400, decimals = 0, prefix = "", suffix = "", className, style,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isInView) return;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className={cn("display-number tabular-nums", className)} style={style}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}
