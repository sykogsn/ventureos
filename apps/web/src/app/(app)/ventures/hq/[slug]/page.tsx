import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VentureHqScreen } from "@/modules/ventures/launch/venture-hq-screen";
import { loadActiveIntelligence } from "@/modules/intelligence/request";
import { getFoundedCompanyBySlug } from "@/modules/intelligence/service";
import { persistActiveVentureSelection } from "@/modules/ventures/select";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Company HQ",
};

export default async function LaunchedVenturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const active = await loadActiveIntelligence();
  if (!active) {
    notFound();
  }

  const company = await getFoundedCompanyBySlug({
    userId: active.session.id,
    workspaceId: active.workspace.id,
    slug,
  });

  if (!company) {
    notFound();
  }

  if (company.venture.identity.id !== active.activeVenture?.id) {
    await persistActiveVentureSelection(company.venture.identity.id);
  }

  return <VentureHqScreen company={company} />;
}
