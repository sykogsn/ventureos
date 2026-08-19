import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { ExecutiveRecommendation } from "../types";

export function Recommendations({
  items,
}: {
  items: ExecutiveRecommendation[];
}) {
  return (
    <SectionCard>
      <div>
        <p className="ids-kicker">Recommendations</p>
        <p className="ids-caption mt-1">
          Generated from Executive Policy findings — not from raw dashboard facts.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyCopy title="This desk is listening">
          Policy findings will arrive as recommendations. Until then, the brief above is the work.
        </EmptyCopy>
      ) : (
      <ol className="flex flex-col">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="border-t border-border py-5 first:border-t-0 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="ids-caption">
                <span className="tabular-nums">{index + 1}</span>
                {" · "}
                {item.company}
                {" · "}
                <span className="ids-code">{item.originatingPolicyId}</span>
                {" · "}
                {item.policyOwner}
                {" · "}
                {item.policySeverity}
              </p>
              <p className="ids-caption">
                {item.confidenceLabel} · {item.confidence}% · consensus{" "}
                {item.executiveConsensus.label}
              </p>
            </div>
            <h3 className="ids-label mt-2 max-w-[40rem]">{item.title}</h3>
            <p className="ids-caption mt-1">{item.originatingPolicyTitle}</p>
            <p className="ids-body mt-2 max-w-[42rem] text-muted">
              <span className="ids-emphasis text-foreground">Finding. </span>
              {item.finding}
            </p>
            <p className="ids-body mt-2 max-w-[42rem] text-foreground">
              {item.recommendedAction}
            </p>
            <p className="ids-body mt-2 max-w-[42rem] text-muted">
              <span className="ids-emphasis text-foreground">Reason. </span>
              {item.reason}
            </p>
            <p className="ids-body mt-2 max-w-[42rem] text-muted">
              <span className="ids-emphasis text-foreground">Impact. </span>
              {item.expectedImpact}
              {" · "}
              <span className="ids-emphasis text-foreground">Effort. </span>
              {item.estimatedEffort}
            </p>
            {item.supportingEvidence.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {item.supportingEvidence.slice(0, 4).map((evidence) => (
                  <li key={evidence.id} className="ids-caption">
                    <span className="ids-emphasis text-foreground">{evidence.label}. </span>
                    {evidence.detail}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      )}
    </SectionCard>
  );
}
