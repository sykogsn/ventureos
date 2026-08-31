import { notFound, redirect } from "next/navigation";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { VisitEntryScreen } from "@/modules/frigora/app/screens/visit-entry-screen";
import { resolveVisitEntry } from "@/modules/frigora/app/views";

export default async function FrigoraVisitEntryPage({
  params,
}: {
  params: Promise<{ ventureId: string; workOrderId: string }>;
}) {
  const { ventureId, workOrderId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const scope = frigoraScope(ctx);

  const result = await resolveVisitEntry(
    scope,
    workOrderId,
    ctx.sessionUserId,
    ctx.canWrite,
  );

  if (result.error) {
    return (
      <p className="ids-caption text-danger" role="alert">
        {result.error}
      </p>
    );
  }

  if (result.redirectPath) {
    redirect(result.redirectPath);
  }

  if (!result.view) {
    notFound();
  }

  return <VisitEntryScreen ctx={ctx} view={result.view} />;
}
