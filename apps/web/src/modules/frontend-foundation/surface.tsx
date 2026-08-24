import type { ReactNode } from "react";
import { SurfaceBody } from "@/core/layout";

const levels = {
  flat: "",
  primary: "ids-surface-card",
  secondary: "vos-panel",
  elevated: "ids-surface-elevated",
  sunken: "ids-surface",
} as const;

export function PresentationSurface({
  level = "primary",
  children,
}: {
  level?: keyof typeof levels;
  children: ReactNode;
}) {
  const surface = levels[level];

  return (
    <div className={surface || undefined}>
      <SurfaceBody>{children}</SurfaceBody>
    </div>
  );
}
