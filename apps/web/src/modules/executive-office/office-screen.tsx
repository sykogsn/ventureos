import { QuietLink } from "./components/quiet-link";
import { ConversationPanel } from "./components/conversation-panel";
import { DecisionHistory } from "./components/decision-history";
import { ExecutiveMemory } from "./components/executive-memory";
import { Recommendations } from "./components/recommendations";
import { TodaysBrief } from "./components/todays-brief";
import { UpcomingDecisions } from "./components/upcoming-decisions";
import { formatBriefingDate, resolveActionHref } from "./format";
import type { ExecutiveProfile } from "./types";
import { PageFrame } from "@/core";
import { Desk, Flow, Inspector, Stack } from "@/core/layout";
import { StatusPill } from "./components/status-pill";
import Link from "next/link";

export function ExecutiveOfficeScreen({
  executive,
  basePath = "/agents",
  now = new Date(),
}: {
  executive: ExecutiveProfile;
  basePath?: string;
  now?: Date;
}) {
  return (
    <PageFrame
      page={executive.role}
      kicker="Executive Office"
      title={executive.name}
      description={executive.remit}
      meta={formatBriefingDate(now)}
      actions={
        <Stack gap="compact">
          <Link href={basePath} className="ids-kicker ids-transition hover:text-foreground">
            Leadership floor
          </Link>
          <StatusPill status={executive.status} label={executive.statusLabel} />
        </Stack>
      }
      summary={<TodaysBrief brief={executive.brief} />}
    >
      <Desk>
        <Flow>
          <QuietLink href={resolveActionHref(executive, basePath)}>
            {executive.primaryAction.label}
          </QuietLink>
          <Recommendations items={executive.recommendations} />
          <DecisionHistory items={executive.decisions} />
          <ExecutiveMemory items={executive.memory} />
          <UpcomingDecisions items={executive.upcoming} />
        </Flow>
        <Inspector sticky>
          <ConversationPanel notes={executive.correspondence} />
        </Inspector>
      </Desk>
    </PageFrame>
  );
}
