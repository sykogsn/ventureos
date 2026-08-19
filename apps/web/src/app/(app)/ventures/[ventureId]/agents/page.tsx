import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { VentureId } from "@/contracts";
import { ExecutiveOfficeFloorScreen } from "@/modules/executive-office";
import { loadVentureScopedIntelligence } from "@/modules/intelligence/request";
import { projectExecutiveFloor } from "@/core/venture";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Executive Office",
};

export default async function VentureAgentsPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const active = await loadVentureScopedIntelligence(ventureId as VentureId);
  if (!active) {
    redirect("/login");
  }

  return (
    <ExecutiveOfficeFloorScreen
      data={projectExecutiveFloor(active.core)}
      basePath={`/ventures/${ventureId}/agents`}
    />
  );
}
