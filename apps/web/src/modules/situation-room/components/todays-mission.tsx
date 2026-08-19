import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { TodaysMission } from "../types";
import { FounderCallAction } from "@/modules/intelligence/founder-call-action";

export function TodaysMission({ mission }: { mission: TodaysMission }) {
  return (
    <SectionCard>
      <div className="flex flex-col gap-1">
        <p className="ids-kicker">
          Today’s mission
        </p>
        <p className="ids-caption">
          {mission.company} · {mission.timeNeeded}
        </p>
        {mission.originatingPolicyTitle ? (
          <p className="ids-caption">
            {mission.originatingPolicyTitle}
            {mission.policyOwner ? ` · ${mission.policyOwner}` : ""}
            {mission.policySeverity ? ` · ${mission.policySeverity}` : ""}
          </p>
        ) : null}
      </div>
      <div className="max-w-[40rem]">
        <h2 className="ids-lead">{mission.title}</h2>
        <p className="ids-body mt-3 text-foreground">{mission.ask}</p>
        {mission.finding ? (
          <p className="ids-body mt-3 text-muted">
            <span className="ids-emphasis text-foreground">Finding. </span>
            {mission.finding}
          </p>
        ) : null}
      </div>
      <dl className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <div>
          <dt className="ids-kicker">
            Why now
          </dt>
          <dd className="ids-body mt-2 text-muted">{mission.whyNow}</dd>
        </div>
        <div>
          <dt className="ids-kicker">
            If you defer
          </dt>
          <dd className="ids-body mt-2 text-muted">
            {mission.ifDeferred}
          </dd>
        </div>
      </dl>
      <FounderCallAction
        href={mission.actionHref}
        decisionId={mission.decisionId}
        ventureId={mission.ventureId}
        ruling={mission.ruling}
      >
        {mission.actionLabel}
      </FounderCallAction>
    </SectionCard>
  );
}
