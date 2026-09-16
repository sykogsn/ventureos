import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { VentureId } from "@/contracts";
import { getSession } from "@/lib/auth/session";
import { isFrigoraVenture } from "@/modules/frigora/app/context";
import {
  frigoraCustomerFacingMetadata,
  frigoraCustomerFacingViewport,
} from "@/modules/frigora/app/pwa/identity";
import { VentureWorkspace } from "@/modules/ventures";
import { getVenture } from "@/modules/ventures/service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}): Promise<Metadata> {
  const session = await getSession();
  if (!session) {
    return {};
  }
  const { ventureId } = await params;
  const venture = await getVenture(session.id, ventureId as VentureId);
  if (!venture || !isFrigoraVenture(venture.definitionId)) {
    return {};
  }
  return frigoraCustomerFacingMetadata();
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}): Promise<Viewport> {
  const session = await getSession();
  if (!session) {
    return {};
  }
  const { ventureId } = await params;
  const venture = await getVenture(session.id, ventureId as VentureId);
  if (!venture || !isFrigoraVenture(venture.definitionId)) {
    return {};
  }
  return frigoraCustomerFacingViewport;
}

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
    <VentureWorkspace
      ventureId={ventureId}
      slug={venture.slug}
      definitionId={venture.definitionId}
    >
      {children}
    </VentureWorkspace>
  );
}
