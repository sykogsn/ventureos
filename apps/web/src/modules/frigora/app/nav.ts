export type VentureSurfaceLink = {
  href: string;
  label: string;
  match: "exact" | "prefix";
};

export function buildVentureSurfaceLinks(input: {
  ventureId: string;
  slug: string;
  definitionId: string;
  companyHomeHref: string;
}): VentureSurfaceLink[] {
  const base = `/ventures/${input.ventureId}`;

  // Frigora customer shell: operational surfaces only — no VentureOS company
  // desk tabs (Company HQ, Executive Office, Documents, CRM, Finance).
  if (input.definitionId === "frigora") {
    return [
      { href: `${base}/operations`, label: "Operations", match: "prefix" },
      { href: `${base}/work/assigned`, label: "My Work", match: "prefix" },
      { href: `${base}/work`, label: "Work", match: "prefix" },
      { href: `${base}/customers`, label: "Customers", match: "prefix" },
      { href: `${base}/catalogue`, label: "Catalogue", match: "prefix" },
    ];
  }

  return [
    { href: input.companyHomeHref, label: "Company HQ", match: "exact" },
    { href: `${base}/agents`, label: "Executive Office", match: "prefix" },
    { href: `${base}/documents`, label: "Documents", match: "exact" },
    { href: `${base}/crm`, label: "CRM", match: "exact" },
    { href: `${base}/finance`, label: "Finance", match: "exact" },
  ];
}
