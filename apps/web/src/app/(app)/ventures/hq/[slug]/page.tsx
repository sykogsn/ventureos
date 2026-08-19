import { notFound } from "next/navigation";
import { VentureHqScreen } from "@/modules/ventures/launch/venture-hq-screen";
import { loadActiveIntelligence } from "@/modules/intelligence/request";
import { getFoundedCompanyBySlug } from "@/modules/intelligence/service";

export const dynamic = "force-dynamic";

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

  return <VentureHqScreen company={company} />;
}
