import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SituationRoomScreen } from "@/modules/situation-room";
import { FounderWelcome } from "@/modules/situation-room/welcome";
import { loadActiveIntelligence } from "@/modules/intelligence/request";
import { projectSituationRoom } from "@/core/venture";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Situation Room",
};

export default async function DashboardPage() {
  const active = await loadActiveIntelligence();
  if (!active) {
    redirect("/login");
  }

  if (active.core.ventures.length === 0) {
    return <FounderWelcome founderName={active.core.founder.name} />;
  }

  return (
    <SituationRoomScreen
      data={projectSituationRoom(active.core, {
        activeVentureId: active.activeVenture?.id,
      })}
    />
  );
}
