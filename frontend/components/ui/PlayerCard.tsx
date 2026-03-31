"use client";
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";

const POSITION_GROUPS: Record<string, "gk" | "def" | "mid" | "atk"> = {
  goalkeeper:    "gk",
  center_back:   "def",
  left_back:     "def",
  right_back:    "def",
  defensive_mid: "mid",
  central_mid:   "mid",
  attacking_mid: "mid",
  left_wing:     "atk",
  right_wing:    "atk",
  center_forward:"atk",
};

const POSITION_CONFIG = {
  gk: {
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0.06) 60%, rgba(8,15,32,0.9) 100%)",
    border: "rgba(245,158,11,0.35)",
    shadow: "rgba(245,158,11,0.35)",
    ring: "rgba(245,158,11,0.7)",
    label: "POR",
    accent: "#f59e0b",
  },
  def: {
    color: "#0ea5e9",
    gradient: "linear-gradient(135deg, rgba(14,165,233,0.22) 0%, rgba(14,165,233,0.06) 60%, rgba(8,15,32,0.9) 100%)",
    border: "rgba(14,165,233,0.35)",
    shadow: "rgba(14,165,233,0.35)",
    ring: "rgba(14,165,233,0.7)",
    label: "DEF",
    accent: "#0ea5e9",
  },
  mid: {
    color: "#00ff87",
    gradient: "linear-gradient(135deg, rgba(0,255,135,0.18) 0%, rgba(0,255,135,0.05) 60%, rgba(8,15,32,0.9) 100%)",
    border: "rgba(0,255,135,0.32)",
    shadow: "rgba(0,255,135,0.30)",
    ring: "rgba(0,255,135,0.7)",
    label: "MED",
    accent: "#00ff87",
  },
  atk: {
    color: "#ff3b30",
    gradient: "linear-gradient(135deg, rgba(255,59,48,0.22) 0%, rgba(255,59,48,0.06) 60%, rgba(8,15,32,0.9) 100%)",
    border: "rgba(255,59,48,0.35)",
    shadow: "rgba(255,59,48,0.30)",
    ring: "rgba(255,59,48,0.7)",
    label: "DEL",
    accent: "#ff3b30",
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:  { label: "●  Disponible",  color: "#00ff87", bg: "rgba(0,255,135,0.14)"    },
  injured:    { label: "●  Lesionado",   color: "#ff3b30", bg: "rgba(255,59,48,0.14)"    },
  recovering: { label: "●  Recuperando", color: "#f97316", bg: "rgba(249,115,22,0.14)"   },
  suspended:  { label: "●  Suspendido",  color: "#f59e0b", bg: "rgba(245,158,11,0.14)"   },
  inactive:   { label: "●  Inactivo",    color: "#64748b", bg: "rgba(100,116,139,0.12)"  },
};

export const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Portero",  center_back: "Def. Central", left_back: "Lat. Izq.",
  right_back: "Lat. Der.", defensive_mid: "MC Def.",   central_mid: "MC",
  attacking_mid: "MC Of.", left_wing: "Ext. Izq.",     right_wing: "Ext. Der.",
  center_forward: "Delantero",
};

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

export function PlayerCard({ id, firstName, lastName, jerseyNumber, position, status, photoUrl, index = 0 }: PlayerCardProps) {
  const group = POSITION_GROUPS[position] ?? "mid";
  const pos = POSITION_CONFIG[group];
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;

  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), { stiffness: 400, damping: 35 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), { stiffness: 400, damping: 35 });
  const brightness = useSpring(1, { stiffness: 400, damping: 35 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    brightness.set(1.05);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    brightness.set(1);
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.04, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 900 }}
    >
      <Link href={`/players/${id}`}>
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX, rotateY,
            transformStyle: "preserve-3d",
            filter: `brightness(${brightness})`,
          }}
          whileHover={{ scale: 1.04 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative rounded-2xl overflow-hidden cursor-pointer select-none"
        >
          {/* Card base */}
          <div
            className="absolute inset-0"
            style={{ background: pos.gradient }}
          />

          {/* Colored top edge accent */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent 5%, ${pos.color} 30%, ${pos.color} 70%, transparent 95%)`,
              boxShadow: `0 0 12px ${pos.shadow}, 0 0 4px ${pos.shadow}`,
            }}
          />

          {/* Colored border */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ border: `1px solid ${pos.border}`, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05)` }}
          />

          {/* Outer glow on hover */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 transition-opacity duration-300"
            style={{ boxShadow: `0 8px 32px ${pos.shadow}40, 0 0 0 1px ${pos.border}` }}
          />

          {/* Dorsal watermark */}
          {jerseyNumber != null && (
            <div
              className="absolute -right-2 -bottom-3 font-black select-none pointer-events-none"
              style={{
                fontSize: 108,
                lineHeight: 1,
                color: pos.color,
                opacity: 0.12,
                fontFamily: "JetBrains Mono, monospace",
                letterSpacing: "-0.06em",
              }}
            >
              {jerseyNumber}
            </div>
          )}

          {/* Status badge — top right */}
          <div className="absolute top-3 right-3 z-20">
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide"
              style={{
                color: statusCfg.color,
                background: statusCfg.bg,
                border: `1px solid ${statusCfg.color}30`,
              }}
            >
              {statusCfg.label}
            </span>
          </div>

          {/* Content */}
          <div className="relative z-10 p-4 pt-5 pb-4">

            {/* Position badge — top left */}
            <span
              className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-md mb-3 inline-block"
              style={{
                color: pos.color,
                background: `${pos.color}18`,
                border: `1px solid ${pos.color}40`,
                letterSpacing: "0.1em",
              }}
            >
              {pos.label}
            </span>

            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-black mb-3"
              style={{
                background: `rgba(8,15,32,0.85)`,
                border: `2px solid ${pos.ring}`,
                color: pos.color,
                boxShadow: `0 0 20px ${pos.shadow}50, 0 4px 12px rgba(0,0,0,0.5)`,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full rounded-xl object-cover" />
              ) : initials}
            </div>

            {/* Name */}
            <div>
              <div className="flex items-baseline gap-1.5 mb-0.5">
                {jerseyNumber != null && (
                  <span className="text-xs font-mono font-bold" style={{ color: pos.color, opacity: 0.6 }}>
                    #{jerseyNumber}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white/95 leading-tight">{firstName}</p>
              <p className="text-sm font-black text-white leading-tight tracking-tight">{lastName}</p>
              <p className="text-xs mt-1.5" style={{ color: "rgba(148,163,184,0.7)" }}>
                {POSITION_LABELS[position] ?? position}
              </p>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
