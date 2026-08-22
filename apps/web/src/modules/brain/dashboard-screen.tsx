import Link from "next/link";
import {
  brainHealth,
  decisions,
  knowledgeObjects,
  recentActivity,
} from "@/platform/brain";
import { Cluster, Desk, Fit, Grid, Inspector, Stack, StackList } from "@/core/layout";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { BrainFrame } from "./components/brain-frame";
import { HealthBand } from "./components/health-band";
import { MetricCard } from "./components/metric-card";

const quickActions = [
  { href: "/brain/library/new", label: "New knowledge", primary: true },
  { href: "/brain/decisions", label: "New decision", primary: false },
  { href: "/brain/search", label: "Search", primary: false },
  { href: "/brain/library", label: "Browse library", primary: false },
] as const;

function rollupBand() {
  if (brainHealth.some((item) => item.band === "risk")) {
    return "risk" as const;
  }
  if (brainHealth.some((item) => item.band === "watch")) {
    return "watch" as const;
  }
  return "healthy" as const;
}

export function BrainDashboardScreen() {
  const band = rollupBand();
  const standards = knowledgeObjects.filter((item) => item.type === "Standard").length;
  const coverage = brainHealth.find((item) => item.id === "coverage");

  return (
    <BrainFrame
      page="Dashboard"
      title="Brain"
      description="Institutional intelligence for the desk. Not a document store."
      meta="v0.1"
    >
      <Grid variant="analytics">
        <SectionCard>
          <p className="ids-kicker">Knowledge health</p>
          <Cluster justify="start">
            <p className="ids-metric capitalize">{band}</p>
            <HealthBand band={band} />
          </Cluster>
          <p className="ids-body text-muted">
            {coverage?.judgement ?? "Coverage is the current judgement of this catalogue."}
          </p>
        </SectionCard>
        <MetricCard
          kicker="Total knowledge objects"
          value={String(knowledgeObjects.length)}
          note="Approved law, living research, and specified work in one catalogue."
        />
        <MetricCard
          kicker="Standards"
          value={String(standards)}
          note="IDS, engineering, and security as objects the desk can cite."
        />
        <MetricCard
          kicker="Architecture decisions"
          value={String(decisions.length)}
          note="Each ruling is a Knowledge Object of type Decision."
        />
      </Grid>

      <Desk>
        <SectionCard title="Recent activity" description="What entered the catalogue.">
          <StackList>
            {recentActivity.map((item) => (
              <li key={item.id}>
                <Stack gap="tight">
                  <p className="ids-caption">{item.at}</p>
                  <Link
                    href={item.href}
                    className="ids-label ids-transition underline-offset-4 hover:underline"
                  >
                    {item.note}
                  </Link>
                </Stack>
              </li>
            ))}
          </StackList>
        </SectionCard>

        <Inspector>
          <SectionCard title="Quick actions" description="Recording is not open in v0.1.">
            <Stack gap="compact">
              {quickActions.map((action) => (
                <Fit key={action.href}>
                  <Link
                    href={action.href}
                    className={action.primary ? "vos-btn-primary" : "vos-btn-secondary"}
                  >
                    {action.label}
                  </Link>
                </Fit>
              ))}
            </Stack>
          </SectionCard>
        </Inspector>
      </Desk>
    </BrainFrame>
  );
}
