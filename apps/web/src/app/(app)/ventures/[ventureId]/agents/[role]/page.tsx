import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { VentureId } from "@/contracts";
import { ExecutiveOfficeScreen, findExecutive } from "@/modules/executive-office";
import { loadVentureScopedIntelligence } from "@/modules/intelligence/request";
import { projectExecutiveFloor } from "@/core/venture";

export const dynamic = "force-dynamic";

type OfficeParams = { ventureId: string; role: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<OfficeParams>;
}): Promise<Metadata> {
  const { ventureId, role } = await params;
  const active = await loadVentureScopedIntelligence(ventureId as VentureId);
  if (!active) {
    return { title: "Executive Office" };
  }

  const executive = findExecutive(
    projectExecutiveFloor(active.core).executives,
    role,
  );

  if (!executive) {
    return { title: "Executive Office" };
  }

  return { title: `${executive.role} · Executive Office` };
}

export default async function VentureExecutiveOfficePage({
  params,
}: {
  params: Promise<OfficeParams>;
}) {
  const { ventureId, role } = await params;
  const active = await loadVentureScopedIntelligence(ventureId as VentureId);
  if (!active) {
    redirect("/login");
  }

  const executive = findExecutive(
    projectExecutiveFloor(active.core).executives,
    role,
  );

  if (!executive) {
    notFound();
  }

  return (
    <ExecutiveOfficeScreen
      executive={executive}
      basePath={`/ventures/${ventureId}/agents`}
    />
  );
}
