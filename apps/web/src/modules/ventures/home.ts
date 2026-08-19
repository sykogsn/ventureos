/** Canonical founder destination for a company. Nested CRM/docs/finance stay on the venture id. */
export function companyHomeHref(slug: string) {
  return `/ventures/hq/${slug}`;
}
