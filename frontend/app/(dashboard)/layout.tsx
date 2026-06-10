"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { TacticalAIChat } from "@/components/ai/TacticalAIChat";
import { LupiDefs } from "@/components/lupi/LupiDefs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [isAuthenticated, router]);

  return (
    <div className="app">
      <LupiDefs />
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
      <Sidebar />
      <main id="main-content" role="main" aria-label="Contenido principal" className="main">
        {children}
      </main>
      <OnboardingTour />
      <TacticalAIChat />
    </div>
  );
}
