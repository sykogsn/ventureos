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
  canManageTeam?: boolean;
  canAccessOffice?: boolean;
}): VentureSurfaceLink[] {
  const base = `/ventures/${input.ventureId}`;

  // Frigora customer shell: operational surfaces only — no VentureOS company
  // desk tabs (Company HQ, Executive Office, Documents, CRM, Finance).
  if (input.definitionId === "frigora") {
    return [
      ...(input.canAccessOffice ? [
        { href: `${base}/operations`, label: "Operations", match: "prefix" as const },
        ...(input.canManageTeam
          ? [{ href: `${base}/team`, label: "Team & Access", match: "prefix" as const }]
          : []),
      ] : []),
      { href: `${base}/work/assigned`, label: "My Work", match: "prefix" },
      ...(input.canAccessOffice ? [
        { href: `${base}/work`, label: "Work", match: "prefix" as const },
        { href: `${base}/customers`, label: "Customers", match: "prefix" as const },
      ] : []),
      { href: `${base}/catalogue`, label: "Catalogue", match: "prefix" },
      ...(input.canAccessOffice ? [
        { href: `${base}/commercial-catalogue`, label: "Commercial Catalogue", match: "prefix" as const },
        { href: `${base}/quotations`, label: "Quotations", match: "prefix" as const },
      ] : []),
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
