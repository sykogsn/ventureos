import { DeferredOperatingScreen } from "@/core/shell/deferred-operating-screen";

export function CrmScreen({ ventureId }: { ventureId: string }) {
  return (
    <DeferredOperatingScreen
      title="CRM"
      ventureId={ventureId}
      summary="CRM is reserved for this company’s pipeline. Foundation v1.1 does not run a live CRM. Company HQ remains the operating record."
    />
  );
}
