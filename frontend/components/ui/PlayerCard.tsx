"use client";
import {
  motion, useMotionValue, useSpring, useTransform,
} from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { getPositionConfig, getStatusConfig } from "@/lib/design-system";
import { usePrefersReducedMotion } from "@/lib/motion";

interface PlayerCardProps {
  id: number;
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
  position: string;
  status: string;
  photoUrl?: string;
  index?: number;
}

/**
 * 3D-tilt trading-card-style player tile.
 * - Mouse-tracked tilt with spring physics (Framer Motion)
 * - Jersey number watermark
 * - Photo when available, silhouette/initials fallback
 * - Position-coloured neon accent
 */
export function PlayerCard({
  id, firstName, lastName, jerseyNumber, position, status, photoUrl, index = 0,
}: PlayerCardProps) {
  const pos = getPositionConfig(position);
  const statusCfg = getStatusConfig(status);
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;

  // ── 3D tilt (disabled if user prefers reduced motion) ──
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 22, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 22, mass: 0.4 });
  const rotateX = useTransform(sy, [-0.5, 0.5], reduced ? ["0deg", "0deg"] : ["8deg", "-8deg"]);
  const rotateY = useTransform(sx, [-0.5, 0.5], reduced ? ["0deg", "0deg"] : ["-8deg", "8deg"]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1000 }}
    >
      <Link href={`/players/${id}`}>
        <motion.div
          ref={ref}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          className="group relative rounded-2xl overflow-hidden cursor-pointer"
          {...({} as any)}
        >
          <div
            className="relative"
            style={{
              background:
                "linear-gradient(180deg, rgba(13,21,40,0.85) 0%, rgba(8,15,32,0.95) 100%)",
              border: `1px solid ${pos.color}30`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${pos.color}15, 0 0 24px ${pos.color}12`,
              borderRadius: 16,
            }}
          >
            {/* Top neon accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${pos.color} 30%, ${pos.color} 70%, transparent 100%)`,
                boxShadow: `0 0 10px ${pos.color}80`,
              }}
            />

            {/* Jersey watermark */}
            {jerseyNumber != null && (
              <div
                className="absolute font-black font-mono leading-none select-none pointer-events-none"
                style={{
                  top: 8, right: 10,
                  fontSize: "5.5rem",
                  color: `${pos.color}10`,
                  letterSpacing: "-0.05em",
                  transform: "translateZ(20px)",
                }}
              >
                {jerseyNumber}
              </div>
            )}

            {/* Status pill */}
            <div
              className="absolute top-3 left-3 z-10"
              style={{ transform: "translateZ(40px)" }}
            >
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-md"
                style={{
                  color: statusCfg.color,
                  background: `${statusCfg.color}15`,
                  borderColor: `${statusCfg.color}40`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: statusCfg.color, boxShadow: `0 0 6px ${statusCfg.color}` }}
                />
                {statusCfg.label}
              </span>
            </div>

            {/* Photo / avatar area */}
            <div
              className="relative h-32 overflow-hidden"
              style={{
                background: `radial-gradient(ellipse at 50% 30%, ${pos.color}22 0%, transparent 70%)`,
              }}
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt={`${firstName} ${lastName}`}
                  className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  style={{ transform: "translateZ(10px)" }}
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transform: "translateZ(20px)" }}
                >
                  <div
                    className="font-black font-mono leading-none"
                    style={{
                      fontSize: "3rem",
                      color: pos.color,
                      letterSpacing: "-0.04em",
                      filter: `drop-shadow(0 0 12px ${pos.color}80)`,
                    }}
                  >
                    {initials}
                  </div>
                </div>
              )}

              {/* Photo gradient overlay */}
              <div
                className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(8,15,32,0.85) 60%, rgba(8,15,32,1) 100%)",
                }}
              />
            </div>

            {/* Body */}
            <div
              className="p-4 pt-2 relative"
              style={{ transform: "translateZ(30px)" }}
            >
              {/* Position badge */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className="inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md border"
                  style={{
                    color: pos.color,
                    background: `${pos.color}12`,
                    borderColor: `${pos.color}30`,
                  }}
                >
                  {pos.short}
                </span>
                {jerseyNumber != null && (
                  <span
                    className="text-[11px] font-mono font-bold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    #{jerseyNumber}
                  </span>
                )}
              </div>

              {/* Name */}
              <div>
                <p className="text-sm font-bold text-white/95 leading-tight truncate">
                  {firstName}
                </p>
                <p className="text-sm font-black text-white leading-tight truncate">
                  {lastName}
                </p>
                <p
                  className="text-[11px] mt-1 font-medium truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {pos.label}
                </p>
              </div>
            </div>

            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 0%, ${pos.color}15, transparent 60%)`,
                borderRadius: 16,
              }}
            />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
