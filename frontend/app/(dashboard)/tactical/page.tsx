import { TacticalBoard } from "@/components/tactical/TacticalBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Map } from "lucide-react";

export default function TacticalPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-6 pt-6 pb-0 shrink-0">
        <PageHeader
          icon={Map}
          title="Pizarra Táctica"
          description="Diseña formaciones, arrastra jugadores y dibuja jugadas"
          badge="Interactivo"
          className="mb-4"
        />
      </div>
      <div className="flex-1 min-h-0">
        <TacticalBoard />
      </div>
    </div>
  );
}
