"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

const RADIUS = 45;
const ARC_FRACTION = 270 / 360;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS * ARC_FRACTION; // ~212

const LEVEL_CONFIG = {
  low:      { color: "#00ff87", glow: "rgba(0,255,135,0.5)",   label: "Bajo" },
  medium:   { color: "#f59e0b", glow: "rgba(245,158,11,0.5)",  label: "Moderado" },
  high:     { color: "#f97316", glow: "rgba(249,115,22,0.5)",  label: "Alto" },
  critical: { color: "#ff3b30", glow: "rgba(255,59,48,0.5)",   label: "Crítico" },
};

interface RiskGaugeProps {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  size?: number;
  showLabel?: boolean;
}

export function RiskGauge({ score, level, size = 120, showLabel = true }: RiskGaugeProps) {
  const ref = useRef<SVGCircleElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true });
  const [animated, setAnimated] = useState(false);

  const config = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.low;
  const targetOffset = CIRCUMFERENCE - (Math.min(score, 100) / 100) * CIRCUMFERENCE;

  useEffect(() => {
    if (isInView && !animated) {
      setTimeout(() => setAnimated(true), 100);
    }
  }, [isInView, animated]);

  return (
    <div ref={containerRef} style={{ width: size, height: size }} className="relative flex-shrink-0">
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <filter id={`glow-${level}`}>
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track background */}
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
          strokeDasharray={`${CIRCUMFERENCE} ${2 * Math.PI * RADIUS - CIRCUMFERENCE}`}
          strokeLinecap="round"
          transform="rotate(135 60 60)"
        />

        {/* Progress arc */}
        <circle
          ref={ref}
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke={config.color}
          strokeWidth="8"
          strokeDasharray={`${CIRCUMFERENCE} ${2 * Math.PI * RADIUS - CIRCUMFERENCE}`}
          strokeDashoffset={animated ? targetOffset : CIRCUMFERENCE}
          strokeLinecap="round"
          transform="rotate(135 60 60)"
          filter={`url(#glow-${level})`}
          style={{
            transition: animated
              ? "stroke-dashoffset 1.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
              : "none",
          }}
        />

        {/* Score text */}
        <text
          x="60" y="57"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={config.color}
          fontSize="22"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="700"
          letterSpacing="-1"
        >
          {score}
        </text>

        {/* Label */}
        {showLabel && (
          <text
            x="60" y="75"
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize="9"
            fontFamily="Inter, sans-serif"
            fontWeight="500"
            letterSpacing="0.5"
          >
            {config.label.toUpperCase()}
          </text>
        )}
      </svg>
    </div>
  );
}
