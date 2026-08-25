import { PageFrame } from "@/core";
import { ExecutiveWorkspaceDesk } from "./desk";
import type { ExecutiveWorkspacePresentation } from "./types";

export function ExecutiveWorkspaceScreen({
  model,
}: {
  model: ExecutiveWorkspacePresentation;
}) {
  return (
    <PageFrame
      page="Executive Workspace"
      kicker={`What requires my attention or decision now? · ${model.founderName}`}
      title="Executive Workspace"
      lede={model.posture}
      description={model.worldLine}
    >
      <ExecutiveWorkspaceDesk model={model} />
    </PageFrame>
  );
}
