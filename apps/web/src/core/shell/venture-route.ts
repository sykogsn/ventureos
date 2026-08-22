export function resolveRouteVentureId(input: {
  routeVentureId?: string;
  routeSlug?: string;
  ventures: { id: string; slug: string }[];
}): string | undefined {
  if (input.routeVentureId) {
    return input.routeVentureId;
  }

  if (input.routeSlug) {
    return input.ventures.find((item) => item.slug === input.routeSlug)?.id;
  }

  return undefined;
}
