import { CatalogueScreen } from "@/modules/frigora/app/screens/catalogue-screen";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  listPartReferencesQuery,
  listRefrigerantReferencesQuery,
} from "@/modules/frigora/queries";

export default async function FrigoraCataloguePage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const scope = frigoraScope(ctx);
  const [parts, refrigerants] = await Promise.all([
    listPartReferencesQuery(scope),
    listRefrigerantReferencesQuery(scope),
  ]);

  return (
    <CatalogueScreen
      ctx={ctx}
      partReferences={parts.record ?? []}
      refrigerantReferences={refrigerants.record ?? []}
      canAdmin={ctx.canWrite}
      error={parts.error ?? refrigerants.error}
    />
  );
}
