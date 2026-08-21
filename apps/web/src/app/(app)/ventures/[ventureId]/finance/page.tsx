import type { Metadata } from "next";
import { FinanceScreen } from "@/modules/finance";

export const metadata: Metadata = {
  title: "Finance",
};

export default async function VentureFinancePage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;

  return <FinanceScreen ventureId={ventureId} />;
}
