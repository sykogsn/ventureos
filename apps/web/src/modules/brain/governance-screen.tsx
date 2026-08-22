import Link from "next/link";
import { Cluster, Grid, Stack } from "@/core/layout";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { governanceInstruments } from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { StatusMark } from "./components/status-mark";

export function BrainGovernanceScreen() {
  return (
    <BrainFrame
      page="Governance"
      title="Governance"
      description="The instruments the desk is bound to. Open an object to read the record."
    >
      <Grid variant="pair">
        {governanceInstruments.map((item) => (
          <Link key={item.id} href={item.href} className="ids-transition">
            <SectionCard className="hover:bg-surface-hover">
              <Cluster justify="between">
                <h2 className="ids-label text-foreground">{item.title}</h2>
                <StatusMark>{item.status}</StatusMark>
              </Cluster>
              <Grid variant="pair">
                <Stack gap="tight">
                  <p className="ids-kicker">Version</p>
                  <p className="ids-body text-muted">{item.version}</p>
                </Stack>
                <Stack gap="tight">
                  <p className="ids-kicker">Owner</p>
                  <p className="ids-body text-muted">{item.owner}</p>
                </Stack>
              </Grid>
              <Stack gap="tight">
                <p className="ids-kicker">Last review</p>
                <p className="ids-body text-muted">{item.lastReview}</p>
              </Stack>
            </SectionCard>
          </Link>
        ))}
      </Grid>
    </BrainFrame>
  );
}
