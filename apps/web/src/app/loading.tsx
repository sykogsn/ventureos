import { ExecutiveLoading } from "@/core/shell/executive-loading";
import { Workspace } from "@/core/layout";

/**
 * Root loading is identity-unknown: product context is not yet established.
 * Do not guess a platform product brand — Frigora hard-entry can flash this boundary.
 */
export default function RootLoading() {
  return (
    <Workspace>
      <ExecutiveLoading productName="" message="Opening..." />
    </Workspace>
  );
}
