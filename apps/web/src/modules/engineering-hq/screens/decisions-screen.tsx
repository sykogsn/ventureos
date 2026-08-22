import { Cluster, Grid, ReadingRegion, Stack, StackList } from "@/core/layout";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { EngineeringCatalogue } from "../types";
import { EngineeringFrame } from "../components/engineering-frame";
import { StatusLamp } from "../components/status-lamp";

export function EngineeringDecisionsScreen({
  catalogue,
}: {
  catalogue: EngineeringCatalogue;
}) {
  return (
    <EngineeringFrame
      page="Decisions"
      title="Decision Register"
      description="Engineering method decisions parsed from DECISION_REGISTER.md. Architecture ADRs and founder calls stay in the Foundation Library."
    >
      {catalogue.decisions.length === 0 ? (
        <EmptyCopy title="No decisions in the register">
          Engineering Records have not named an ERD yet.
        </EmptyCopy>
      ) : (
        <StackList>
          {catalogue.decisions.map((item) => (
            <li key={item.id}>
              <Stack gap="compact">
                <Cluster justify="start">
                  <p className="ids-caption">{item.id}</p>
                  <StatusLamp tone="healthy">{item.status}</StatusLamp>
                </Cluster>
                <h2 className="ids-label text-foreground">{item.title}</h2>
                <Grid variant="pair">
                  <Stack gap="tight">
                    <p className="ids-kicker">Reason</p>
                    <p className="ids-body text-muted">{item.reason}</p>
                  </Stack>
                  <Stack gap="tight">
                    <p className="ids-kicker">Outcome</p>
                    <p className="ids-body text-muted">{item.outcome}</p>
                  </Stack>
                </Grid>
                <ReadingRegion size="lg">
                  <p className="ids-body text-muted">{item.decision}</p>
                </ReadingRegion>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </EngineeringFrame>
  );
}
