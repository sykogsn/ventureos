import { ExecutiveLoading } from "@/core/shell/executive-loading";
import { Workspace } from "@/core/layout";

export default function RootLoading() {
  return (
    <Workspace>
      <ExecutiveLoading message="Opening VentureOS..." />
    </Workspace>
  );
}
