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

export function PlayerCard({ id, firstName, lastName, jerseyNumber, position, status, photoUrl, index = 0 }: PlayerCardProps) {
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
        <div className="group relative rounded-xl overflow-hidden cursor-pointer bg-surface-2/40 border border-white/[0.06] hover:border-white/[0.1] hover:bg-surface-2/60 transition-all duration-200">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: pos.color, opacity: 0.6 }} />

          {/* Status badge */}
          <div className="absolute top-3 right-3 z-10">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{ color: statusCfg.color, background: `${statusCfg.color}10`, borderColor: `${statusCfg.color}25` }}>
              <span className="w-1 h-1 rounded-full" style={{ background: statusCfg.color }} />
              {statusCfg.label}
            </span>
          </div>

          <div className="p-4 pt-5">
            {/* Position badge */}
            <span className="inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md mb-3 border"
              style={{ color: pos.color, background: `${pos.color}10`, borderColor: `${pos.color}25` }}>
              {pos.short}
            </span>

            {/* Avatar */}
            <div className="w-12 h-12 rounded-lg flex items-center justify-center text-base font-bold mb-3 border-2"
              style={{ borderColor: `${pos.color}40`, color: pos.color, background: `${pos.color}08` }}>
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : initials}
            </div>

            {/* Info */}
            <div>
              {jerseyNumber != null && (
                <span className="text-[11px] font-mono font-bold text-white/30">#{jerseyNumber}</span>
              )}
              <p className="text-sm font-bold text-white/95 leading-tight mt-0.5">{firstName}</p>
              <p className="text-sm font-bold text-white leading-tight">{lastName}</p>
              <p className="text-xs text-white/30 mt-1">{pos.label}</p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
