import { FinanceScreen } from "@/modules/finance";

export default async function VentureFinancePage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;

  return <FinanceScreen ventureId={ventureId} />;
}
