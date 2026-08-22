import Link from "next/link";
import { HealthPill } from "@/modules/dashboard/components/pills";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { OperatingHealth } from "../types";
import { Cluster, ReadingRegion, Stack, StackList } from "@/core/layout";

export function OperatingHealth({ health }: { health: OperatingHealth }) {
  return (
    <SectionCard>
      <Cluster justify="between">
        <Stack gap="tight">
          <p className="ids-kicker">Operating health</p>
          <p className="ids-label text-foreground">{health.posture}</p>
        </Stack>
        <Cluster justify="end" wrap={false}>
          <span className="ids-caption tabular-nums">{health.score}</span>
          <HealthPill band={health.band} />
        </Cluster>
      </Cluster>
      <ReadingRegion size="lg">
        <p className="ids-body text-muted">{health.verdict}</p>
      </ReadingRegion>
      {health.watches.length === 0 ? (
        <EmptyCopy title="No situations detected">
          Operating health will name companies that need attention once a constraint appears.
        </EmptyCopy>
      ) : (
        <StackList>
          {health.watches.map((watch) => (
            <li key={watch.id}>
              <Stack gap="tight">
                <Cluster justify="start">
                  <Link
                    href={watch.companyHref}
                    className="ids-label ids-transition underline-offset-4 hover:underline"
                  >
                    {watch.company}
                  </Link>
                  <HealthPill band={watch.band} />
                </Cluster>
                <p className="ids-body text-muted">{watch.judgement}</p>
                <p className="ids-body text-foreground">{watch.ask}</p>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </SectionCard>
  );
}
