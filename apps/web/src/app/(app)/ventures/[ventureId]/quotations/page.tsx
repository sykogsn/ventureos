import { QuotationsScreen } from "@/modules/frigora/app/screens/quotations-screen";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  listQuotationCreateSourcesQuery,
  listQuotationsQuery,
} from "@/modules/frigora/queries";

export default async function FrigoraQuotationsPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const scope = frigoraScope(ctx);
  const [quotations, sources] = await Promise.all([
    listQuotationsQuery(scope),
    listQuotationCreateSourcesQuery(scope),
  ]);

  return (
    <QuotationsScreen
      ctx={ctx}
      quotations={quotations.record ?? []}
      sources={sources.record ?? []}
      error={quotations.error ?? sources.error}
    />
  );
}
