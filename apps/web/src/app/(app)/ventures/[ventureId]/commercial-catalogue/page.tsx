import { CommercialCatalogueScreen } from "@/modules/frigora/app/screens/commercial-catalogue-screen";
import { commercialItemCosts } from "@/modules/frigora/app/commercial-catalogue-office";
import { requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { createCommercialCatalogue } from "@/modules/frigora/commercial-catalogue";
import { isFrigoraError } from "@/modules/frigora/errors";
import { createScope } from "@/modules/frigora/service";
import { getPlatform } from "@/platform/kernel";
import type { UserId } from "@/contracts";

function one(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

export default async function FrigoraCommercialCataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ ventureId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ventureId } = await params;
  const query = await searchParams;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const scope = createScope({
    userId: ctx.sessionUserId as UserId,
    workspaceId: ctx.workspaceId,
    ventureId: ctx.ventureId,
  });
  const filters = {
    sku: one(query.sku),
    description: one(query.description),
    manufacturer: one(query.manufacturer),
    model: one(query.model),
    category: one(query.category),
    status: one(query.status) === "active" || one(query.status) === "discontinued" ? one(query.status) : "",
  };
  const catalogue = createCommercialCatalogue({ permissions: getPlatform().permissions });
  const canReadCost = await getPlatform().permissions.can({
    userId: ctx.sessionUserId as UserId,
    permission: "venture.commercial_cost.read",
    resource: { type: "workspace", id: ctx.workspaceId },
  });
  const canUpdateCost = await getPlatform().permissions.can({
    userId: ctx.sessionUserId as UserId,
    permission: "venture.commercial_cost.update",
    resource: { type: "workspace", id: ctx.workspaceId },
  });
  let items: Awaited<ReturnType<typeof catalogue.listItems>> = [];
  let error: string | undefined;
  try {
    items = await catalogue.listItems(scope, {
      sku: filters.sku,
      description: filters.description,
      manufacturer: filters.manufacturer,
      model: filters.model,
      category: filters.category,
      status: filters.status === "active" || filters.status === "discontinued" ? filters.status : undefined,
    });
  } catch (caught) {
    if (!isFrigoraError(caught)) throw caught;
    error = caught.message;
  }
  const costs = canReadCost ? await commercialItemCosts(catalogue, scope, items, canReadCost) : null;
  return (
    <CommercialCatalogueScreen
      ctx={ctx}
      items={items}
      filters={filters}
      error={error}
      canReadCost={canReadCost}
      canUpdateCost={canUpdateCost}
      costs={costs}
    />
  );
}
