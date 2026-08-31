import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { OperationsScreen } from "@/modules/frigora/app/screens/operations-screen";
import { loadOperationsOverview } from "@/modules/frigora/app/views";

export default async function FrigoraOperationsPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const { view, error } = await loadOperationsOverview(frigoraScope(ctx));

  return <OperationsScreen ctx={ctx} view={view} error={error} />;
}
