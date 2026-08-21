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
        <div className="flex flex-col items-end gap-3">
          <Link href={basePath} className="ids-kicker ids-transition hover:text-foreground">
            Leadership floor
          </Link>
          <StatusPill status={executive.status} label={executive.statusLabel} />
        </div>
      }
      summary={<TodaysBrief brief={executive.brief} />}
    >
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="flex flex-col gap-8">
          <div>
            <QuietLink href={resolveActionHref(executive, basePath)}>
              {executive.primaryAction.label}
            </QuietLink>
          </div>
          <Recommendations items={executive.recommendations} />
          <DecisionHistory items={executive.decisions} />
          <ExecutiveMemory items={executive.memory} />
          <UpcomingDecisions items={executive.upcoming} />
        </div>
        <ConversationPanel notes={executive.correspondence} />
      </div>
    </PageFrame>
  );
}
