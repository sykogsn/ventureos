import { cn } from "@/utils/cn";
import type { HealthTone } from "../types";

const toneClass: Record<HealthTone, string> = {
  healthy: "ids-status-healthy",
  watch: "ids-status-watch",
  risk: "ids-status-risk",
  unknown: "ids-status-quiet",
};

const toneLabel: Record<HealthTone, string> = {
  healthy: "Green",
  watch: "Amber",
  risk: "Red",
  unknown: "Unknown",
};

export function StatusLamp({
  tone,
  children,
}: {
  tone: HealthTone;
  children?: string;
}) {
  return (
    <span className={cn("ids-pill", toneClass[tone])}>
      {children ?? toneLabel[tone]}
    </span>
  );
}
