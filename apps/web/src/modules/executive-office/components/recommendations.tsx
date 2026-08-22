import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { ExecutiveRecommendation } from "../types";
import { Cluster, ReadingRegion, Stack, StackList } from "@/core/layout";

export function Recommendations({
  items,
}: {
  items: ExecutiveRecommendation[];
}) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Recommendations</p>
        <p className="ids-caption">
          Generated from Executive Policy findings — not from raw dashboard facts.
        </p>
      </Stack>
      {items.length === 0 ? (
        <EmptyCopy title="No intelligence available">
          Policy findings will arrive as recommendations. Until then, the brief above is the work.
        </EmptyCopy>
      ) : (
        <StackList as="ol">
          {items.map((item, index) => (
            <li key={item.id}>
              <Stack gap="tight">
                <Cluster justify="between">
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
                </Cluster>
                <ReadingRegion size="md">
                  <h3 className="ids-label">{item.title}</h3>
                </ReadingRegion>
                <p className="ids-caption">{item.originatingPolicyTitle}</p>
                <ReadingRegion size="lg">
                  <Stack gap="tight">
                    <p className="ids-body text-muted">
                      <span className="ids-emphasis text-foreground">Finding. </span>
                      {item.finding}
                    </p>
                    <p className="ids-body text-foreground">{item.recommendedAction}</p>
                    <p className="ids-body text-muted">
                      <span className="ids-emphasis text-foreground">Reason. </span>
                      {item.reason}
                    </p>
                    <p className="ids-body text-muted">
                      <span className="ids-emphasis text-foreground">Impact. </span>
                      {item.expectedImpact}
                      {" · "}
                      <span className="ids-emphasis text-foreground">Effort. </span>
                      {item.estimatedEffort}
                    </p>
                  </Stack>
                </ReadingRegion>
                {item.supportingEvidence.length > 0 ? (
                  <Stack gap="tight">
                    {item.supportingEvidence.slice(0, 4).map((evidence) => (
                      <p key={evidence.id} className="ids-caption">
                        <span className="ids-emphasis text-foreground">{evidence.label}. </span>
                        {evidence.detail}
                      </p>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </SectionCard>
  );
}
