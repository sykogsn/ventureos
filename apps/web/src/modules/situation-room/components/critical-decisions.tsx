import Link from "next/link";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { CriticalDecision } from "../types";
import { FounderCallAction } from "@/modules/intelligence/founder-call-action";

export function CriticalDecisions({
  decisions,
}: {
  decisions: CriticalDecision[];
}) {
  return (
    <SectionCard>
      <div>
        <p className="ids-kicker">Critical decisions</p>
        <p className="ids-caption mt-1">
          One call. Everything else is work, not judgement.
        </p>
      </div>
      {decisions.length === 0 ? (
        <EmptyCopy title="No call is waiting">
          The next founder judgement will appear here when policy evaluation has a recommendation.
        </EmptyCopy>
      ) : (
      <ol className="flex flex-col gap-6">
        {decisions.map((decision, index) => (
          <li
            key={decision.id}
            className="border-t border-border pt-5 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
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
            </div>
            <h3 className="ids-label mt-2 max-w-[40rem]">
              {decision.question}
            </h3>
            {decision.originatingPolicyTitle ? (
              <p className="ids-caption mt-1">
                {decision.originatingPolicyTitle}
                {decision.policyOwner ? ` · ${decision.policyOwner}` : ""}
                {decision.policySeverity ? ` · ${decision.policySeverity}` : ""}
              </p>
            ) : null}
            {decision.finding ? (
              <p className="ids-body mt-3 max-w-[42rem] text-muted">
                <span className="ids-emphasis text-foreground">Finding. </span>
                {decision.finding}
              </p>
            ) : null}
            <p className="ids-body mt-3 max-w-[42rem] text-muted">
              <span className="ids-emphasis text-foreground">Recommendation. </span>
              {decision.recommendation}
            </p>
            <p className="ids-body mt-2 max-w-[42rem] text-muted">
              <span className="ids-emphasis text-foreground">If you wait. </span>
              {decision.costOfInaction}
            </p>
            <div className="mt-3">
              <FounderCallAction
                href={decision.actionHref}
                decisionId={decision.id}
                ventureId={decision.ventureId}
                ruling={decision.ruling ?? decision.recommendation}
              >
                {decision.actionLabel}
              </FounderCallAction>
            </div>
          </li>
        ))}
      </ol>
      )}
    </SectionCard>
  );
}
