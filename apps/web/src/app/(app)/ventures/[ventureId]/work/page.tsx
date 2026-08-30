import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { WorkListScreen } from "@/modules/frigora/app/screens/work-screens";
import { loadWorkOrderList } from "@/modules/frigora/app/views";

export default async function FrigoraWorkPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const { rows, error } = await loadWorkOrderList(frigoraScope(ctx));

  return <WorkListScreen ctx={ctx} rows={rows} error={error} />;
}
