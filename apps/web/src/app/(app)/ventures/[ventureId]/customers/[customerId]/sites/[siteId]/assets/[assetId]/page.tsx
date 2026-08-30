import { notFound } from "next/navigation";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { AssetDetailScreen } from "@/modules/frigora/app/screens/site-asset-screens";
import {
  getAssetQuery,
  getCustomerQuery,
  getSiteQuery,
} from "@/modules/frigora/queries";

export default async function FrigoraAssetDetailPage({
  params,
}: {
  params: Promise<{
    ventureId: string;
    customerId: string;
    siteId: string;
    assetId: string;
  }>;
}) {
  const { ventureId, customerId, siteId, assetId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const scope = frigoraScope(ctx);

  const [customerResult, siteResult, assetResult] = await Promise.all([
    getCustomerQuery({ ...scope, id: customerId }),
    getSiteQuery({ ...scope, id: siteId }),
    getAssetQuery({ ...scope, id: assetId }),
  ]);

  if (customerResult.error || siteResult.error || assetResult.error) {
    return (
      <p className="ids-caption text-danger" role="alert">
        {customerResult.error ?? siteResult.error ?? assetResult.error}
      </p>
    );
  }
  if (!customerResult.record || !siteResult.record || !assetResult.record) {
    notFound();
  }
  if (
    siteResult.record.customerId !== customerResult.record.id ||
    assetResult.record.siteId !== siteResult.record.id
  ) {
    notFound();
  }

  return (
    <AssetDetailScreen
      ctx={ctx}
      customer={customerResult.record}
      site={siteResult.record}
      asset={assetResult.record}
    />
  );
}
