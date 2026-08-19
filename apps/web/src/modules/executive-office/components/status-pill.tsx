import { cn } from "@/utils/cn";
import type { OperatingStatus } from "../types";

const statusClass: Record<OperatingStatus, string> = {
  "awaiting-founder": "ids-status-watch",
  "in-session": "ids-status-healthy",
  watching: "ids-status-quiet",
  clear: "ids-status-healthy",
};

export function StatusPill({
  status,
  label,
}: {
  status: OperatingStatus;
  label: string;
}) {
  return (
    <span
      className={cn("ids-pill", statusClass[status])}
    >
      {label}
    </span>
  );
}
