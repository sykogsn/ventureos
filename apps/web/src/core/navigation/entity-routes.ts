/**
 * Venture-scoped route construction for product entity navigation.
 *
 * This module owns path safety and venture preservation only. It does not know
 * product entity types, grant access, or manufacture destinations.
 */
export function entityPathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function ventureEntityPath(
  ventureId: string,
  ...segments: string[]
): string {
  return [
    "",
    "ventures",
    entityPathSegment(ventureId),
    ...segments.map(entityPathSegment),
  ].join("/");
}
