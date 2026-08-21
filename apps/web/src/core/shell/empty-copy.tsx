import type { ReactNode } from "react";
import { ReadingRegion, Stack } from "@/core/layout";

export function EmptyCopy({
  kicker,
  title,
  children,
  action,
}: {
  kicker?: string;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <ReadingRegion size="md">
      <Stack gap="compact">
        {kicker ? <p className="ids-kicker">{kicker}</p> : null}
        {title ? <p className="ids-label text-foreground">{title}</p> : null}
        <p className="ids-body text-muted">{children}</p>
        {action ? action : null}
      </Stack>
    </ReadingRegion>
  );
}
