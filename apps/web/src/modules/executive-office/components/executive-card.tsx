import Link from "next/link";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { officePath } from "../format";
import type { ExecutiveProfile } from "../types";
import { StatusPill } from "./status-pill";
import { Cluster, Stack, Stretch } from "@/core/layout";

export function ExecutiveCard({
  executive,
  basePath,
}: {
  executive: ExecutiveProfile;
  basePath: string;
}) {
  return (
    <Stretch>
      <Link href={officePath(basePath, executive.id)} className="group block">
        <SectionCard className="ids-transition group-hover:border-accent/35">
          <Cluster justify="between">
            <Stack gap="tight">
              <p className="ids-kicker">{executive.role}</p>
              <h2 className="ids-subhead">{executive.name}</h2>
              <p className="ids-caption">{executive.remit}</p>
            </Stack>
            <Stack gap="tight">
              <p className="ids-kicker">Status</p>
              <StatusPill status={executive.status} label={executive.statusLabel} />
            </Stack>
          </Cluster>

          <Stack gap="tight">
            <p className="ids-kicker">Today’s brief</p>
            <p className="ids-label">{executive.brief.headline}</p>
            <p className="ids-body text-muted">{executive.brief.body}</p>
          </Stack>

          <Stack gap="tight">
            <p className="ids-kicker">Recommendation</p>
            <p className="ids-body text-foreground">
              {executive.primaryRecommendation.recommendedAction}
            </p>
            {executive.primaryRecommendation.originatingPolicyId !== "none" ? (
              <p className="ids-caption">
                {executive.primaryRecommendation.originatingPolicyTitle} ·{" "}
                {executive.primaryRecommendation.policySeverity}
              </p>
            ) : null}
          </Stack>

          <Stack gap="tight">
            <p className="ids-kicker">Primary action</p>
            <p className="ids-label text-foreground underline-offset-4 group-hover:underline">
              {executive.primaryAction.label}
            </p>
          </Stack>
        </SectionCard>
      </Link>
    </Stretch>
  );
}
