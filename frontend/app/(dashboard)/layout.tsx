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
    <div className="flex h-screen overflow-hidden bg-surface-base">


      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0 p-6">
        {children}
      </main>
    </div>
  );
}
