import type { ReactNode } from "react";
import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Fit, Grid, Stack } from "@/core/layout";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import {
  WORKFORCE_VERIFICATION_LANGUAGE,
  type WorkforceDeskState,
} from "@/modules/workforce/desk";
import { WorkforceEmployeeDirectory } from "@/modules/workforce/employee-directory";

function WorkforceEmpty({
  title,
  children,
  action,
}: {
  title: string;
  children: string;
  action?: ReactNode;
}) {
  return (
    <EmptyCopy title={title} action={action}>
      {children}
    </EmptyCopy>
  );
}

export function WorkforceDeskScreen({ state }: { state: WorkforceDeskState }) {
  return (
    <PageFrame
      page="Workforce"
      kicker="Operate"
      title="Workforce"
      lede="The operating surface for governed AI employees."
      description="Understand which AI employees exist, what work they have performed, and whether execution and verification completed safely."
      footer={<p className="ids-caption">{WORKFORCE_VERIFICATION_LANGUAGE}</p>}
    >
      {state === "workspace-required" ? (
        <WorkforceEmpty title="A workspace is required">
          Select or create a workspace from the header to open Workforce.
        </WorkforceEmpty>
      ) : null}

      {state === "unauthorised" ? (
        <WorkforceEmpty title="Operating authority is required">
          This desk is for operators who can update the company. Read-only
          membership cannot inspect Workforce.
        </WorkforceEmpty>
      ) : null}

      {state === "company-required" ? (
        <WorkforceEmpty
          title="No company on this desk"
          action={
            <Fit>
              <Link href="/ventures/launch" className="vos-btn-primary">
                Found Company
              </Link>
            </Fit>
          }
        >
          Found a company to place governed AI employees on this operating
          surface.
        </WorkforceEmpty>
      ) : null}

      {state === "ready" ? (
        <Grid variant="pair">
          <section aria-labelledby="workforce-employees-heading">
            <SectionCard>
              <Stack gap="compact">
                <h2 id="workforce-employees-heading" className="ids-kicker">
                  Employees
                </h2>
                <WorkforceEmployeeDirectory />
              </Stack>
            </SectionCard>
          </section>
          <section aria-labelledby="workforce-runs-heading">
            <SectionCard>
              <Stack gap="compact">
                <h2 id="workforce-runs-heading" className="ids-kicker">
                  Runs
                </h2>
                <EmptyCopy>
                  Work already performed appears in this region. Opening a run
                  inspects execution and verification, not whether the AI was
                  correct.
                </EmptyCopy>
              </Stack>
            </SectionCard>
          </section>
        </Grid>
      ) : null}
    </PageFrame>
  );
}
