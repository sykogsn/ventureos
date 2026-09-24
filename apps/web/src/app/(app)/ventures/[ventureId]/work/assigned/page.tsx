import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { MyWorkScreen } from "@/modules/frigora/app/screens/my-work-screen";
import { loadMyWork } from "@/modules/frigora/app/views";

export default async function FrigoraMyWorkPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const { rows, error } = await loadMyWork(frigoraScope(ctx), ctx.sessionUserId);

  return <MyWorkScreen ctx={ctx} rows={rows} error={error} />;
}
