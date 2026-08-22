import Link from "next/link";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { CriticalDecision } from "../types";
import { FounderCallAction } from "@/modules/intelligence/founder-call-action";
import { Cluster, ReadingRegion, Stack, StackList } from "@/core/layout";

export function CriticalDecisions({
  decisions,
}: {
  decisions: CriticalDecision[];
}) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Critical decisions</p>
        <p className="ids-caption">One call. Everything else is work, not judgement.</p>
      </Stack>
      {decisions.length === 0 ? (
        <EmptyCopy title="No call is waiting">
          The next founder judgement will appear here when policy evaluation has a recommendation.
        </EmptyCopy>
      ) : (
        <StackList as="ol">
          {decisions.map((decision, index) => (
            <li key={decision.id}>
              <Stack gap="compact">
                <Cluster justify="between">
                  <p className="ids-caption">
                    <span className="tabular-nums">{index + 1}</span>
                    {" · "}
                    <Link
                      href={decision.companyHref}
                      className="ids-transition underline-offset-4 hover:underline"
                    >
                      {decision.company}
                    </Link>
                  </p>
                  <p className="ids-caption">Decide by {decision.decideBy}</p>
                </Cluster>
                <ReadingRegion size="md">
                  <h3 className="ids-label">{decision.question}</h3>
                </ReadingRegion>
                {decision.originatingPolicyTitle ? (
                  <p className="ids-caption">
                    {decision.originatingPolicyTitle}
                    {decision.policyOwner ? ` · ${decision.policyOwner}` : ""}
                    {decision.policySeverity ? ` · ${decision.policySeverity}` : ""}
                  </p>
                ) : null}
                {decision.finding ? (
                  <ReadingRegion size="lg">
                    <p className="ids-body text-muted">
                      <span className="ids-emphasis text-foreground">Finding. </span>
                      {decision.finding}
                    </p>
                  </ReadingRegion>
                ) : null}
                <ReadingRegion size="lg">
                  <Stack gap="tight">
                    <p className="ids-body text-muted">
                      <span className="ids-emphasis text-foreground">Recommendation. </span>
                      {decision.recommendation}
                    </p>
                    <p className="ids-body text-muted">
                      <span className="ids-emphasis text-foreground">If you wait. </span>
                      {decision.costOfInaction}
                    </p>
                  </Stack>
                </ReadingRegion>
                <FounderCallAction
                  href={decision.actionHref}
                  decisionId={decision.id}
                  ventureId={decision.ventureId}
                  ruling={decision.ruling ?? decision.recommendation}
                >
                  {decision.actionLabel}
                </FounderCallAction>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </SectionCard>
  );
}
