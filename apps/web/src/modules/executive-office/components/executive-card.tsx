import Link from "next/link";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { officePath } from "../format";
import type { ExecutiveProfile } from "../types";
import { StatusPill } from "./status-pill";

export function ExecutiveCard({
  executive,
  basePath,
}: {
  executive: ExecutiveProfile;
  basePath: string;
}) {
  return (
    <Link href={officePath(basePath, executive.id)} className="group block h-full">
      <SectionCard className="ids-transition h-full group-hover:border-accent/35">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ids-kicker">{executive.role}</p>
            <h2 className="ids-subhead mt-1">{executive.name}</h2>
            <p className="ids-caption mt-1">{executive.remit}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <p className="ids-kicker">Status</p>
            <StatusPill status={executive.status} label={executive.statusLabel} />
          </div>
        </div>

        <div>
          <p className="ids-kicker">Today’s brief</p>
          <p className="ids-label mt-2">{executive.brief.headline}</p>
          <p className="ids-body mt-2 text-muted">{executive.brief.body}</p>
        </div>

        <div>
          <p className="ids-kicker">Recommendation</p>
          <p className="ids-body mt-2 text-foreground">
            {executive.primaryRecommendation.recommendedAction}
          </p>
          {executive.primaryRecommendation.originatingPolicyId !== "none" ? (
            <p className="ids-caption mt-2">
              {executive.primaryRecommendation.originatingPolicyTitle} ·{" "}
              {executive.primaryRecommendation.policySeverity}
            </p>
          ) : null}
        </div>

        <div className="mt-auto">
          <p className="ids-kicker">Primary action</p>
          <p className="ids-label mt-2 text-foreground underline-offset-4 group-hover:underline">
            {executive.primaryAction.label}
          </p>
        </div>
      </SectionCard>
    </Link>
  );
}
