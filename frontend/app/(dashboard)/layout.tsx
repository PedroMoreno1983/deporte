"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { TacticalAIChat } from "@/components/ai/TacticalAIChat";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [isAuthenticated, router]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <Sidebar />
      <main
        id="main-content"
        role="main"
        aria-label="Contenido principal"
        className="flex-1 overflow-y-auto min-w-0 px-4 sm:px-5 lg:px-6 py-4 sm:py-5 lg:py-6 pt-16 lg:pt-6"
      >
        {children}
      </main>
      <OnboardingTour />
      <TacticalAIChat />
    </div>
  );
}
