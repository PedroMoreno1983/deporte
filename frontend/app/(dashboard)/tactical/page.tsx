import { TacticalBoard } from "@/components/tactical/TacticalBoard";
import { PageTitle } from "@/components/lupi/viz";

export default function TacticalPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-6 pt-6 pb-0 shrink-0">
        <PageTitle title="Pizarra táctica" subtitle="diseña formaciones, arrastra jugadores y dibuja jugadas" />
      </div>
      <div className="flex-1 min-h-0">
        <TacticalBoard />
      </div>
    </div>
  );
}
