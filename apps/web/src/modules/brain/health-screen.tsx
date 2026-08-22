import { Cluster, Grid, ReadingRegion } from "@/core/layout";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { brainHealth } from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { HealthBand } from "./components/health-band";

export function BrainHealthScreen() {
  return (
    <BrainFrame
      page="Health"
      title="Brain health"
      description="Placeholder judgement of the catalogue. These metrics are not computed from a backend."
    >
      <Grid variant="pair">
        {brainHealth.map((item) => (
          <SectionCard key={item.id}>
            <Cluster justify="between">
              <h2 className="ids-kicker">{item.title}</h2>
              <HealthBand band={item.band} />
            </Cluster>
            <p className="ids-metric">{item.value}</p>
            <ReadingRegion size="lg">
              <p className="ids-body text-muted">{item.judgement}</p>
            </ReadingRegion>
          </SectionCard>
        ))}
      </Grid>
    </BrainFrame>
  );
}
