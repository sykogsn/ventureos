/**
 * VentureOS Navigation Affordance Standard.
 *
 * These rules are platform defaults for current and generated ventures.
 * Ventures own their domain model and destination resolution; VentureOS owns
 * the semantic behaviour once a valid destination is supplied.
 */
export const NAVIGATION_AFFORDANCE_STANDARD = {
  version: "1.0.0",
  rules: [
    "Navigate a displayed domain entity only when a supported destination exists and access is authorised.",
    "Preserve the active workspace and venture context for venture-scoped entity navigation.",
    "Render missing or unsupported destinations as text, never placeholder or dead links.",
    "Keep informational state, status, priority, counts, and decorative labels non-navigable unless they represent a genuine destination.",
    "Use semantic links with keyboard focus and normal browser link behaviour.",
    "Use entity trails only for real domain relationships; navigable ancestors are links and the current item is not.",
    "Expose predictable product-level parent or collection return paths where meaningful rather than relying only on browser history.",
    "Keep entity links and trails usable when names, references, or addresses wrap on narrow layouts.",
    "Navigation affordances do not replace authentication, membership, role, or data-access enforcement.",
    "Generated ventures should reuse VentureOS navigation primitives and register product-specific destinations instead of creating incompatible link semantics.",
  ],
} as const;
