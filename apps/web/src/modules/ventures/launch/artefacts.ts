import { inferVentureGenome } from "./genome";
import type { AiExecutiveId, FoundedCompany, LaunchDraft } from "./types";
import { slugFromName } from "./validation";
import type { ExecutiveRoleId } from "@/core/executive-office";
import { definitionHasFeature } from "@/core/venture-definition/enforcement";
import { bootstrapProduct } from "./products";
import { createVentureFromFounding } from "@/core/venture";

const foundingSeatMap: Record<AiExecutiveId, ExecutiveRoleId> = {
  "chief-of-staff": "coo",
  growth: "cmo",
  finance: "cfo",
  legal: "counsel",
  product: "cpo",
  revenue: "sales",
};

export function foundCompany(draft: LaunchDraft): FoundedCompany {
  const genome = inferVentureGenome(draft);
  const name = draft.name.trim() || "Untitled";
  const slug = slugFromName(draft.name);
  const seatedRoleIds = draft.aiEnabled
    ? [...new Set(draft.executiveIds.map((id) => foundingSeatMap[id]))]
    : [];

  const instance = bootstrapProduct(draft.productId ?? "");
  const officeEnabled =
    Boolean(draft.aiEnabled) &&
    definitionHasFeature(instance.definition, "executive-office");

  const venture = createVentureFromFounding({
    slug,
    name,
    genome,
    officeEnabled,
    seatedRoleIds: officeEnabled ? seatedRoleIds : [],
    definition: instance.ref,
  });

  return {
    slug,
    foundedAt: venture.identity.foundedAt,
    draft: {
      ...draft,
      productId: instance.ref.id as LaunchDraft["productId"],
      definitionId: instance.ref.id,
      definitionVersion: instance.ref.version,
    },
    venture,
  };
}
