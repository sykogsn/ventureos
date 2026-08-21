import { cn } from "@/utils/cn";

export function StatusMark({ children }: { children: string }) {
  return (
    <span className={cn("ids-pill ids-status-quiet")}>{children}</span>
  );
}
