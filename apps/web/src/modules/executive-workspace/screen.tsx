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
      kicker={`Daily judgement · ${model.founderName}`}
      title="Executive Workspace"
      lede={model.posture}
      description={model.worldLine}
    >
      <ExecutiveWorkspaceDesk model={model} />
    </PageFrame>
  );
}
