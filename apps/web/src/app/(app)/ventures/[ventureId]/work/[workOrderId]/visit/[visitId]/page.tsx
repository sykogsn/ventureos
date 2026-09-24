import { notFound } from "next/navigation";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { VisitRecorderScreen } from "@/modules/frigora/app/screens/visit-recorder-screen";
import { loadVisitRecorder } from "@/modules/frigora/app/views";

export default async function FrigoraVisitRecorderPage({
  params,
}: {
  params: Promise<{ ventureId: string; workOrderId: string; visitId: string }>;
}) {
  const { ventureId, workOrderId, visitId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const { view, error } = await loadVisitRecorder(
    frigoraScope(ctx),
    workOrderId,
    visitId,
    ctx.sessionUserId,
    ctx.canWrite,
  );

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

  return <VisitRecorderScreen ctx={ctx} view={view} />;
}
