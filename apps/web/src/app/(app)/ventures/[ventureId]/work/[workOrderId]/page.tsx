import { notFound } from "next/navigation";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { WorkDetailScreen } from "@/modules/frigora/app/screens/work-screens";
import { loadWorkOrderDetail } from "@/modules/frigora/app/views";

export default async function FrigoraWorkDetailPage({
  params,
}: {
  params: Promise<{ ventureId: string; workOrderId: string }>;
}) {
  const { ventureId, workOrderId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const { view, error } = await loadWorkOrderDetail(frigoraScope(ctx), workOrderId);

  if (error) {
    return (
      <p className="ids-caption text-danger" role="alert">
        {error}
      </p>
    );
  }
  if (!view) {
    notFound();
  }

  return <WorkDetailScreen ctx={ctx} view={view} />;
}
