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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <dt className="ids-kicker">{label}</dt>
      <dd className="ids-label text-right">{value}</dd>
    </div>
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
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-surface px-4">
        <p className="ids-kicker pt-4">Venture Genome</p>
        <p className="ids-body mt-2">{genome.thesis}</p>
        <dl className="mt-2">
          <Row label="Motion" value={genome.motion} />
          <Row label="Posture" value={genome.posture === "ai-native" ? "AI-native" : "Human-led"} />
          <Row label="Risk" value={genome.risk} />
          <Row label="Cadence" value={genome.cadence} />
        </dl>
      </div>
      <div className="rounded-lg border border-border bg-surface px-4">
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
        <p className="ids-body py-4 text-muted">
          Founding runs the launch sequence and opens Company HQ with every
          operating artefact already in place.
        </p>
      </div>
    </div>
  );
}
