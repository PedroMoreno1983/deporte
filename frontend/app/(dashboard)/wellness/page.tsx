import { WellnessDashboard } from "@/components/wellness/WellnessDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { HeartPulse } from "lucide-react";

export default function WellnessPage() {
  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <PageHeader
        icon={HeartPulse}
        title="Wellness Diario"
        description="Control del estado físico y mental del plantel"
        badge="Hoy"
        iconColor="text-rose-400"
        iconBg="bg-rose-500/10 border-rose-500/20"
        badgeColor="text-rose-400 bg-rose-500/10 border-rose-500/20"
        className="pl-10 sm:pl-12 lg:pl-0"
      />
      <WellnessDashboard />
    </div>
  );
}
