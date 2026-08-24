import type { ReactNode } from "react";
import { InsetSurface, Stack } from "@/core/layout";

export function StateBlock({
  title,
  description,
  tone = "neutral",
  action,
}: {
  title: string;
  description?: string;
  tone?: "neutral" | "informative" | "warning" | "critical";
  action?: ReactNode;
}) {
  const kicker =
    tone === "critical"
      ? "Critical"
      : tone === "warning"
        ? "Watch"
        : tone === "informative"
          ? "Notice"
          : "State";

  return (
    <div role="status">
      <InsetSurface>
        <Stack gap="compact">
          <p className="ids-kicker">{kicker}</p>
          <p className="ids-label text-foreground">{title}</p>
          {description ? <p className="ids-caption">{description}</p> : null}
          {action ? action : null}
        </Stack>
      </InsetSurface>
    </div>
  );
}
