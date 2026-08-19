import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import type { HealthBand } from "../types";

const bandClass: Record<HealthBand, string> = {
  healthy: "ids-status-healthy",
  watch: "ids-status-watch",
  risk: "ids-status-risk",
};

export function Pill({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn("ids-pill", className)}
    >
      {children}
    </span>
  );
}

export function HealthPill({ band }: { band: HealthBand }) {
  return <Pill className={bandClass[band]}>{band}</Pill>;
}
