import { DeferredOperatingScreen } from "@/core/shell/deferred-operating-screen";

export function FinanceScreen({ ventureId }: { ventureId: string }) {
  return (
    <DeferredOperatingScreen
      title="Finance"
      ventureId={ventureId}
      summary="Finance operations are reserved. Runway and cash judgement stay in Situation Room, Company HQ, and the CFO desk when seated."
    />
  );
}
