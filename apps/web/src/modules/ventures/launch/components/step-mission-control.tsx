import { inferVentureGenome } from "../genome";
import {
  categoryOptions,
  executiveOptions,
  goalOptions,
  labelFor,
  stageOptions,
} from "../options";
import { listLaunchProducts } from "../products";
import type { LaunchDraft } from "../types";
import { DefinitionRow, Stack, SurfaceBody } from "@/core/layout";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <DefinitionRow>
      <dt className="ids-kicker">{label}</dt>
      <dd className="ids-label">{value}</dd>
    </DefinitionRow>
  );
}

export function StepMissionControl({ draft }: { draft: LaunchDraft }) {
  const genome = inferVentureGenome(draft);
  const team =
    draft.aiEnabled && draft.executiveIds.length > 0
      ? draft.executiveIds
          .map((id) => labelFor(executiveOptions, id))
          .join(", ")
      : "Unseated";

  return (
    <Stack gap="form">
      <div className="ids-surface-card">
        <SurfaceBody>
          <Stack gap="tight">
            <p className="ids-kicker">Venture Genome</p>
            <p className="ids-body">{genome.thesis}</p>
            <dl>
              <Row label="Motion" value={genome.motion} />
              <Row
                label="Posture"
                value={genome.posture === "ai-native" ? "AI-native" : "Human-led"}
              />
              <Row label="Risk" value={genome.risk} />
              <Row label="Cadence" value={genome.cadence} />
            </dl>
          </Stack>
        </SurfaceBody>
      </div>
      <div className="ids-surface-card">
        <SurfaceBody>
          <Stack gap="tight">
            <dl>
              <Row
                label="Product"
                value={labelFor(listLaunchProducts(), draft.productId)}
              />
              <Row label="Company" value={draft.name.trim() || "Untitled"} />
              <Row label="Category" value={labelFor(categoryOptions, draft.categoryId)} />
              <Row label="Stage" value={labelFor(stageOptions, draft.stageId)} />
              <Row label="Primary goal" value={labelFor(goalOptions, draft.goalId)} />
              <Row
                label="Executive Office"
                value={draft.aiEnabled ? "Open" : "Closed"}
              />
              <Row label="Seated" value={team} />
            </dl>
            <p className="ids-body text-muted">
              Founding runs the launch sequence and opens Company HQ with every
              operating artefact already in place.
            </p>
          </Stack>
        </SurfaceBody>
      </div>
    </Stack>
  );
}
