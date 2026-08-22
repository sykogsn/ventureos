import { Cluster, Grid, Stack, StackList } from "@/core/layout";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { DebtRecord, EngineeringCatalogue, HealthTone } from "../types";
import type { EngineeringIntelligence } from "../intelligence/types";
import { EngineeringFrame } from "../components/engineering-frame";
import { StatusLamp } from "../components/status-lamp";

function debtTone(item: DebtRecord): HealthTone {
  if (/high/i.test(item.priority)) {
    return "risk";
  }
  if (/medium/i.test(item.priority)) {
    return "watch";
  }
  return "healthy";
}

export function EngineeringDebtScreen({
  catalogue,
  intelligence,
}: {
  catalogue: EngineeringCatalogue;
  intelligence: EngineeringIntelligence;
}) {
  const summary = intelligence.debt;

  return (
    <EngineeringFrame
      page="Debt"
      title="Technical Debt"
      description="Debt intelligence from TECHNICAL_DEBT_REGISTER.md. Trend is Unknown until dated snapshots exist."
    >
      <Grid variant="analytics">
        <SectionCard>
          <p className="ids-kicker">Total</p>
          <p className="ids-metric">{String(summary.total)}</p>
        </SectionCard>
        <SectionCard>
          <p className="ids-kicker">High</p>
          <p className="ids-metric">{String(summary.high)}</p>
        </SectionCard>
        <SectionCard>
          <p className="ids-kicker">Medium</p>
          <p className="ids-metric">{String(summary.medium)}</p>
        </SectionCard>
        <SectionCard>
          <p className="ids-kicker">Low</p>
          <p className="ids-metric">{String(summary.low)}</p>
        </SectionCard>
      </Grid>
      <SectionCard title="Debt intelligence">
        <Stack gap="tight">
          <p className="ids-body text-muted">
            Open {summary.open}. Resolved {summary.resolved}. Recently added:{" "}
            {summary.recentlyAdded}.
          </p>
          <p className="ids-caption">{summary.trend}</p>
        </Stack>
      </SectionCard>
      {catalogue.debt.length === 0 ? (
        <EmptyCopy title="No named debt">The register is empty.</EmptyCopy>
      ) : (
        <StackList>
          {catalogue.debt.map((item) => (
            <li key={item.id}>
              <Stack gap="tight">
                <Cluster justify="start">
                  <p className="ids-caption">{item.id}</p>
                  <StatusLamp tone={debtTone(item)}>{item.priority}</StatusLamp>
                  <p className="ids-caption">{item.status}</p>
                </Cluster>
                <h2 className="ids-label text-foreground">{item.title}</h2>
                <p className="ids-body text-muted">{item.description}</p>
                <p className="ids-caption">Impact: {item.impact}</p>
                <p className="ids-caption">
                  Owner: {item.owner} · Sprint: {item.sprint}
                </p>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </EngineeringFrame>
  );
}
