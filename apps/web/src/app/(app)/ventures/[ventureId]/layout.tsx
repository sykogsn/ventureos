import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import type { VentureId } from "@/contracts";
import { getSession } from "@/lib/auth/session";
import { VentureWorkspace } from "@/modules/ventures";
import { getVenture } from "@/modules/ventures/service";

export default async function VentureLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ ventureId: string }>;
}) {
  const session = await getSession();
  const { ventureId } = await params;

  if (!session) {
    notFound();
  }

  const venture = await getVenture(session.id, ventureId as VentureId);
  if (!venture) {
    notFound();
  }

  return (
    <VentureWorkspace ventureId={ventureId} slug={venture.slug}>
      {children}
    </VentureWorkspace>
  );
}
