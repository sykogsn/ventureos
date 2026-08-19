import { notFound, redirect } from "next/navigation";
import type { VentureId } from "@/contracts";
import { getSession } from "@/lib/auth/session";
import { companyHomeHref } from "@/modules/ventures/home";
import { getVenture } from "@/modules/ventures/service";

export default async function VenturePage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const { ventureId } = await params;
  const venture = await getVenture(session.id, ventureId as VentureId);

  if (!venture) {
    notFound();
  }

  redirect(companyHomeHref(venture.slug));
}
