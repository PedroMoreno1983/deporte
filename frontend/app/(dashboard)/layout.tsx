"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [isAuthenticated, router]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--surface-base)" }}
    >
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 10% 40%, rgba(0,255,135,0.055) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 90% 10%, rgba(14,165,233,0.045) 0%, transparent 55%),
            radial-gradient(ellipse 50% 60% at 60% 90%, rgba(139,92,246,0.03) 0%, transparent 50%)
          `,
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 flex w-full h-full">
        <Sidebar />
        <main
          className="flex-1 overflow-y-auto pt-0 lg:pt-0"
          style={{ background: "transparent" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
