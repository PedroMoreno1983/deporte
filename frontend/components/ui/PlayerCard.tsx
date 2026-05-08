"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { getPositionConfig, getStatusConfig } from "@/lib/design-system";

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

export function PlayerCard({
  id,
  firstName,
  lastName,
  jerseyNumber,
  position,
  status,
  photoUrl,
  index = 0,
}: PlayerCardProps) {
  const pos = getPositionConfig(position);
  const statusCfg = getStatusConfig(status);
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/players/${id}`}>
        <div
          className="group relative rounded-[14px] overflow-hidden cursor-pointer transition-all duration-200"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${pos.color}35`;
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${pos.color}20`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-subtle)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.5)";
          }}
        >
          {/* Top accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{
              background: `linear-gradient(90deg, ${pos.color} 0%, ${pos.color}60 60%, transparent 100%)`,
            }}
          />

          {/* Jersey number as background watermark */}
          {jerseyNumber != null && (
            <div
              className="absolute top-1 right-2 font-black font-mono leading-none select-none pointer-events-none"
              style={{ fontSize: "3.5rem", color: `${pos.color}08` }}
            >
              {jerseyNumber}
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-3 right-3 z-10">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{
                color: statusCfg.color,
                background: `${statusCfg.color}12`,
                borderColor: `${statusCfg.color}28`,
              }}
            >
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: statusCfg.color }}
              />
              {statusCfg.label}
            </span>
          </div>

          <div className="p-4 pt-5 relative">
            {/* Position badge */}
            <span
              className="inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md mb-3 border"
              style={{
                color: pos.color,
                background: `${pos.color}10`,
                borderColor: `${pos.color}25`,
              }}
            >
              {pos.short}
            </span>

            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-black mb-3 relative"
              style={{
                background: `linear-gradient(135deg, ${pos.color}18 0%, ${pos.color}08 100%)`,
                border: `2px solid ${pos.color}35`,
                color: pos.color,
              }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt=""
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                initials
              )}
            </div>

            {/* Info */}
            <div>
              {jerseyNumber != null && (
                <span className="text-[11px] font-mono font-bold" style={{ color: "var(--text-muted)" }}>
                  #{jerseyNumber}
                </span>
              )}
              <p className="text-sm font-bold text-white/95 leading-tight mt-0.5">
                {firstName}
              </p>
              <p className="text-sm font-bold text-white leading-tight">{lastName}</p>
              <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-muted)" }}>
                {pos.label}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
