"use client";

import { EntityLink } from "./entity-link";
import type { EntityTrailItem } from "./types";

/**
 * Product-domain relationship trail.
 *
 * Ancestors navigate only when the venture supplied a supported destination.
 * The current item is always non-navigable and exposes current-page semantics.
 */
export function EntityTrail({
  items,
  label = "Entity trail",
}: {
  items: readonly EntityTrailItem[];
  label?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={label} className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const current = item.current ?? index === items.length - 1;

          return (
            <li key={item.key} className="flex min-w-0 items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="ids-caption shrink-0 text-muted">
                  /
                </span>
              ) : null}
              {current ? (
                <span
                  aria-current="page"
                  className="ids-caption min-w-0 break-words text-foreground"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <EntityLink href={item.href}>{item.label}</EntityLink>
              ) : (
                <span className="ids-caption min-w-0 break-words text-muted">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
