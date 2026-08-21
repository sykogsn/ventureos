import type { Metadata } from "next";
import { CrmScreen } from "@/modules/crm";

export const metadata: Metadata = {
  title: "CRM",
};

export default async function VentureCrmPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;

  return <CrmScreen ventureId={ventureId} />;
}
