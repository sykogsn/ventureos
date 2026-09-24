import { notFound } from "next/navigation";
import { Stack } from "@/core/layout";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { CreateAssetForm } from "@/modules/frigora/app/forms/create-asset-form";
import { SiteDetailScreen } from "@/modules/frigora/app/screens/site-asset-screens";
import {
  getCustomerQuery,
  getSiteQuery,
  listAssetsBySiteQuery,
} from "@/modules/frigora/queries";

export default async function FrigoraSiteDetailPage({
  params,
}: {
  params: Promise<{ ventureId: string; customerId: string; siteId: string }>;
}) {
  const { ventureId, customerId, siteId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const scope = frigoraScope(ctx);

  const [customerResult, siteResult] = await Promise.all([
    getCustomerQuery({ ...scope, id: customerId }),
    getSiteQuery({ ...scope, id: siteId }),
  ]);

  if (customerResult.error || siteResult.error) {
    return (
      <p className="ids-caption text-danger" role="alert">
        {customerResult.error ?? siteResult.error}
      </p>
    );
  }
  if (!customerResult.record || !siteResult.record) {
    notFound();
  }
  if (siteResult.record.customerId !== customerResult.record.id) {
    notFound();
  }

  const assetsResult = await listAssetsBySiteQuery({ ...scope, siteId });

  return (
    <SiteDetailScreen
      ctx={ctx}
      customer={customerResult.record}
      site={siteResult.record}
      assets={assetsResult.record ?? []}
      createAssetSlot={
        ctx.canWrite ? (
          <Stack gap="compact">
            <h2 className="ids-label text-foreground">Create asset</h2>
            <CreateAssetForm
              workspaceId={ctx.workspaceId}
              ventureId={ctx.ventureId}
              customerId={customerResult.record.id}
              siteId={siteResult.record.id}
            />
          </Stack>
        ) : (
          <p className="ids-caption text-muted">
            Creating assets requires venture update permission.
          </p>
        )
      }
    />
  );
}
