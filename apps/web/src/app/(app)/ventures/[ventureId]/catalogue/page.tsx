import { CatalogueScreen } from "@/modules/frigora/app/screens/catalogue-screen";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  getVentureCommercialSettingsQuery,
  listPartReferencesQuery,
  listRefrigerantReferencesQuery,
} from "@/modules/frigora/queries";
import type { FrigoraVentureCommercialSettings } from "@/modules/frigora/types";

export default async function FrigoraCataloguePage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const scope = frigoraScope(ctx);
  const [parts, refrigerants, commercial] = await Promise.all([
    listPartReferencesQuery(scope),
    listRefrigerantReferencesQuery(scope),
    ctx.canWrite
      ? getVentureCommercialSettingsQuery(scope)
      : Promise.resolve({
          record: null as FrigoraVentureCommercialSettings | null,
          error: undefined as string | undefined,
        }),
  ]);

  return (
    <CatalogueScreen
      ctx={ctx}
      partReferences={parts.record ?? []}
      refrigerantReferences={refrigerants.record ?? []}
      commercialSettings={commercial.record ?? null}
      canAdmin={ctx.canWrite}
      error={parts.error ?? refrigerants.error ?? commercial.error}
    />
  );
}
