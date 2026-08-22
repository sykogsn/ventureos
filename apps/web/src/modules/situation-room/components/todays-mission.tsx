import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { TodaysMission } from "../types";
import { FounderCallAction } from "@/modules/intelligence/founder-call-action";
import { MetricPair, ReadingRegion, Stack } from "@/core/layout";

export function TodaysMission({ mission }: { mission: TodaysMission }) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Today’s mission</p>
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
      </Stack>
      <ReadingRegion size="lg">
        <Stack gap="compact">
          <h2 className="ids-lead">{mission.title}</h2>
          <p className="ids-body text-foreground">{mission.ask}</p>
          {mission.finding ? (
            <p className="ids-body text-muted">
              <span className="ids-emphasis text-foreground">Finding. </span>
              {mission.finding}
            </p>
          ) : null}
        </Stack>
      </ReadingRegion>
      <MetricPair>
        <div>
          <dt className="ids-kicker">Why now</dt>
          <dd className="ids-body text-muted">{mission.whyNow}</dd>
        </div>
        <div>
          <dt className="ids-kicker">If you defer</dt>
          <dd className="ids-body text-muted">{mission.ifDeferred}</dd>
        </div>
      </MetricPair>
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
