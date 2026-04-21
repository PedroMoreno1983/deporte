import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn("skeleton rounded-xl", className)} style={style} />;
}

/** Pre-built skeleton for a KPI card row */
export function SkeletonKPIRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}

/** Pre-built skeleton for a card grid */
export function SkeletonCardGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-52 rounded-2xl" style={{ animationDelay: `${i * 0.06}s` }} />
      ))}
    </div>
  );
}
