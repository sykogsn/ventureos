import { QuietLink } from "./components/quiet-link";
import { ConversationPanel } from "./components/conversation-panel";
import { DecisionHistory } from "./components/decision-history";
import { ExecutiveMemory } from "./components/executive-memory";
import { OfficeHeader } from "./components/office-header";
import { Recommendations } from "./components/recommendations";
import { TodaysBrief } from "./components/todays-brief";
import { UpcomingDecisions } from "./components/upcoming-decisions";
import { formatBriefingDate, resolveActionHref } from "./format";
import type { ExecutiveProfile } from "./types";

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
    <section className="flex min-h-full flex-1 flex-col">
      <div className="vos-screen mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-8">
        <OfficeHeader
          executive={executive}
          basePath={basePath}
          dateLabel={formatBriefingDate(now)}
        />
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
          <div className="flex flex-col gap-8">
            <TodaysBrief brief={executive.brief} />
            <div className="px-1">
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
      </div>
    </section>
  );
}
