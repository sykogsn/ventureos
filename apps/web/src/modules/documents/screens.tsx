import { DeferredOperatingScreen } from "@/core/shell/deferred-operating-screen";

export function DocumentsScreen({ ventureId }: { ventureId: string }) {
  return (
    <DeferredOperatingScreen
      title="Documents"
      ventureId={ventureId}
      summary="Document operations are reserved. Suggested founding documents live on Company HQ. This route is not a second document system."
    />
  );
}
