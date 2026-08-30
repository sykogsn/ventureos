import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { WorkCreateScreen } from "@/modules/frigora/app/screens/work-screens";
import { loadWorkCreateOptions } from "@/modules/frigora/app/views";

export default async function FrigoraWorkCreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ ventureId: string }>;
  searchParams: Promise<{
    customerId?: string;
    siteId?: string;
    primaryAssetId?: string;
  }>;
}) {
  const { ventureId } = await params;
  const query = await searchParams;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const { options, error } = await loadWorkCreateOptions(frigoraScope(ctx));

  return (
    <WorkCreateScreen
      ctx={ctx}
      options={options}
      error={error}
      initialCustomerId={query.customerId}
      initialSiteId={query.siteId}
      initialAssetId={query.primaryAssetId}
    />
  );
}
