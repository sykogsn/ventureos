import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExecutiveOfficeFloorScreen } from "@/modules/executive-office";
import { loadActiveIntelligence } from "@/modules/intelligence/request";
import { projectExecutiveFloor } from "@/core/venture";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Executive Office",
};

export default async function AgentsPage() {
  const active = await loadActiveIntelligence();
  if (!active) {
    redirect("/login");
  }

  return (
    <ExecutiveOfficeFloorScreen
      data={projectExecutiveFloor(active.core, {
        activeVentureId: active.activeVenture?.id,
      })}
      basePath="/agents"
    />
  );
}
