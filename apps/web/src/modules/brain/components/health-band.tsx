import { cn } from "@/utils/cn";
import type { BrainHealthMetric } from "@/platform/brain";

const bandClass: Record<BrainHealthMetric["band"], string> = {
  healthy: "ids-status-healthy",
  watch: "ids-status-watch",
  risk: "ids-status-risk",
};

export function HealthBand({ band }: { band: BrainHealthMetric["band"] }) {
  return <span className={cn("ids-pill", bandClass[band])}>{band}</span>;
}
