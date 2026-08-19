import Link from "next/link";
import { HealthPill } from "@/modules/dashboard/components/pills";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { OperatingHealth } from "../types";

export function OperatingHealth({ health }: { health: OperatingHealth }) {
  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ids-kicker">Operating health</p>
          <p className="ids-label mt-2 text-foreground">{health.posture}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="ids-caption tabular-nums">{health.score}</span>
          <HealthPill band={health.band} />
        </div>
      </div>
      <p className="ids-body max-w-[42rem] text-muted">{health.verdict}</p>
      {health.watches.length === 0 ? (
        <EmptyCopy title="Nothing is on watch">
          Operating health will name companies that need attention once a company is in the
          portfolio.
        </EmptyCopy>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {health.watches.map((watch) => (
            <li key={watch.id} className="flex flex-col gap-1 py-4 first:pt-4 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={watch.companyHref}
                  className="ids-label ids-transition underline-offset-4 hover:underline"
                >
                  {watch.company}
                </Link>
                <HealthPill band={watch.band} />
              </div>
              <p className="ids-body text-muted">{watch.judgement}</p>
              <p className="ids-body text-foreground">{watch.ask}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
