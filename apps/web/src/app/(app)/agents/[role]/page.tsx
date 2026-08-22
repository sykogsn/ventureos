import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExecutiveOfficeScreen, findExecutive } from "@/modules/executive-office";
import { loadActiveIntelligence } from "@/modules/intelligence/request";
import { executiveRoleOrder } from "@/core/executive-office";
import { projectExecutiveFloor } from "@/core/venture";

export const dynamic = "force-dynamic";

type OfficeParams = { role: string };

export function generateStaticParams() {
  return executiveRoleOrder.map((role) => ({ role }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<OfficeParams>;
}): Promise<Metadata> {
  const { role } = await params;
  const active = await loadActiveIntelligence();
  if (!active) {
    return { title: "Executive Office" };
  }

  const executive = findExecutive(
    projectExecutiveFloor(active.core, {
      activeVentureId: active.activeVenture?.id,
    }).executives,
    role,
  );

  if (!executive) {
    return { title: "Executive Office" };
  }

  return { title: `${executive.role} · Executive Office` };
}

export default async function ExecutiveOfficePage({
  params,
}: {
  params: Promise<OfficeParams>;
}) {
  const { role } = await params;
  const active = await loadActiveIntelligence();
  if (!active) {
    redirect("/login");
  }

  const executive = findExecutive(
    projectExecutiveFloor(active.core, {
      activeVentureId: active.activeVenture?.id,
    }).executives,
    role,
  );

  if (!executive) {
    notFound();
  }

  return <ExecutiveOfficeScreen executive={executive} basePath="/agents" />;
}
