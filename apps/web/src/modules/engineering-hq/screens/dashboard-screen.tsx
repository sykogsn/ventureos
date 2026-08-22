import { Cluster, Desk, Grid, Inspector, Stack, StackList } from "@/core/layout";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { EngineeringCatalogue } from "../types";
import type { EngineeringIntelligence } from "../intelligence/types";
import { EngineeringFrame } from "../components/engineering-frame";
import { StatusLamp } from "../components/status-lamp";

function Fact({
  kicker,
  value,
  note,
}: {
  kicker: string;
  value: string;
  note: string;
}) {
  return (
    <SectionCard>
      <p className="ids-kicker">{kicker}</p>
      <p className="ids-metric">{value}</p>
      <p className="ids-body text-muted">{note}</p>
    </SectionCard>
  );
}

export function EngineeringDashboardScreen({
  catalogue,
  intelligence,
}: {
  catalogue: EngineeringCatalogue;
  intelligence: EngineeringIntelligence;
}) {
  const latestDecision = catalogue.decisions.at(-1);
  const latestLesson = catalogue.lessons.at(-1);
  const latestDebt = catalogue.debt.at(-1);
  const latestRelease = catalogue.releases[0];
  const primary = intelligence.recommendations[0];

  return (
    <EngineeringFrame
      page="Dashboard"
      title="Engineering HQ"
      description="Presentation only. Engineering Intelligence analyses Engineering Records. Records remain authoritative."
      meta="Intelligence v0.1"
    >
      <Grid variant="analytics">
        <Fact
          kicker="Current sprint"
          value={intelligence.sprints.currentId}
          note={intelligence.sprints.currentTitle}
        />
        <Fact
          kicker="Current phase"
          value={intelligence.sprints.currentPhase}
          note="VES mode is recorded only when an in-progress sprint exists on the ledger."
        />
        <SectionCard>
          <p className="ids-kicker">Engineering health</p>
          <Cluster justify="start">
            <p className="ids-metric">{intelligence.health.label}</p>
            <StatusLamp tone={intelligence.health.tone} />
          </Cluster>
          <p className="ids-body text-muted">{intelligence.health.method}</p>
        </SectionCard>
        <SectionCard>
          <p className="ids-kicker">Architecture health</p>
          <Cluster justify="start">
            <p className="ids-metric">{intelligence.architecture.verdict}</p>
            <StatusLamp tone={intelligence.architecture.tone} />
          </Cluster>
          <p className="ids-body text-muted">
            {intelligence.architecture.evidence[0] ?? "Unknown"}
          </p>
        </SectionCard>
      </Grid>

      <Desk>
        <Stack gap="section">
          <SectionCard
            title="Current recommendation"
            description={primary?.source ?? "Derived from Engineering Records."}
          >
            {primary ? (
              <Stack gap="tight">
                <p className="ids-label text-foreground">{primary.title}</p>
                <p className="ids-body text-muted">Why: {primary.why}</p>
              </Stack>
            ) : (
              <p className="ids-body text-muted">Unknown. No recommendation could be derived.</p>
            )}
          </SectionCard>
          <SectionCard title="Recommendation engine" description="Every item names why.">
            <StackList>
              {intelligence.recommendations.map((item) => (
                <li key={item.id}>
                  <Stack gap="tight">
                    <p className="ids-label text-foreground">{item.title}</p>
                    <p className="ids-body text-muted">Why: {item.why}</p>
                    <p className="ids-caption">{item.source}</p>
                  </Stack>
                </li>
              ))}
            </StackList>
          </SectionCard>
          <SectionCard title="Sprint intelligence">
            <Stack gap="tight">
              <p className="ids-body text-muted">
                Completed: {intelligence.sprints.completedCount}. Latest milestone:{" "}
                {intelligence.sprints.latestMilestone}. Next planned:{" "}
                {intelligence.sprints.nextPlanned}.
              </p>
              {intelligence.sprints.evidence.map((line) => (
                <p key={line} className="ids-caption">
                  {line}
                </p>
              ))}
            </Stack>
          </SectionCard>
          <SectionCard title="Health score inputs" description="Unknown criteria are excluded.">
            <StackList>
              {intelligence.health.criteria.map((item) => (
                <li key={item.id}>
                  <Cluster justify="between">
                    <Stack gap="tight">
                      <p className="ids-label text-foreground">{item.label}</p>
                      <p className="ids-caption">{item.evidence}</p>
                    </Stack>
                    <p className="ids-caption">
                      {item.points === null ? "Unknown" : `${item.points}/${item.max}`}
                    </p>
                  </Cluster>
                </li>
              ))}
            </StackList>
          </SectionCard>
        </Stack>
        <Inspector>
          <Stack gap="compact">
            <SectionCard title="Quality intelligence">
              <Stack gap="tight">
                <Cluster justify="start">
                  <StatusLamp tone={intelligence.quality.overall.tone} />
                  <p className="ids-label text-foreground">
                    {intelligence.quality.overall.label}
                  </p>
                </Cluster>
                <p className="ids-caption">{intelligence.quality.overall.evidence}</p>
              </Stack>
            </SectionCard>
            <SectionCard title="Latest decision" description={latestDecision?.id}>
              <Stack gap="tight">
                <p className="ids-label text-foreground">{latestDecision?.title ?? "Unknown"}</p>
                <p className="ids-body text-muted">{latestDecision?.outcome ?? "Unknown"}</p>
              </Stack>
            </SectionCard>
            <SectionCard title="Latest lesson" description={latestLesson?.id}>
              <p className="ids-body text-muted">{latestLesson?.title ?? "Unknown"}</p>
            </SectionCard>
            <SectionCard title="Latest technical debt" description={latestDebt?.id}>
              <p className="ids-body text-muted">{latestDebt?.title ?? "Unknown"}</p>
            </SectionCard>
            <SectionCard title="Latest certification">
              <p className="ids-caption">
                {intelligence.foundation.version} · {intelligence.foundation.date}
              </p>
            </SectionCard>
            <SectionCard title="Latest release">
              <p className="ids-caption">
                {latestRelease?.name ?? "Unknown"} · {latestRelease?.status ?? "Unknown"}
              </p>
            </SectionCard>
          </Stack>
        </Inspector>
      </Desk>
    </EngineeringFrame>
  );
}
