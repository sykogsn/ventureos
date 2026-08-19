export const IDS_BRANDS = ["ventureos", "qualora", "calviora", "farmora"] as const;

export type IdsBrand = (typeof IDS_BRANDS)[number];

const definitionToBrand: Record<string, IdsBrand> = {
  "ventureos.company": "ventureos",
  qualora: "qualora",
  calviora: "calviora",
  farmora: "farmora",
};

export function brandFromDefinitionId(
  definitionId: string | null | undefined,
): IdsBrand {
  if (!definitionId) {
    return "ventureos";
  }

  return definitionToBrand[definitionId] ?? "ventureos";
}

export function applyIdsBrand(target: HTMLElement, brand: IdsBrand): void {
  target.setAttribute("data-ids-brand", brand);
}
