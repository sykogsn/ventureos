import type { ReactNode } from "react";

export type EntityNavigationDestination = string | null | undefined;

/**
 * Venture-owned route-resolution contract.
 *
 * VentureOS defines the contract and destination semantics. Each venture owns
 * the domain reference, context, and concrete resolution logic. Returning
 * null/undefined means there is no supported destination and callers must
 * degrade to non-navigable text.
 */
export type EntityRouteResolver<TReference, TContext> = (
  reference: TReference,
  context: TContext,
) => EntityNavigationDestination;

export type EntityTrailItem = {
  key: string;
  label: ReactNode;
  href?: EntityNavigationDestination;
  current?: boolean;
};
