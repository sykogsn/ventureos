import { CompanyStoryHighlights } from "./components/company-story-highlights";
import { CriticalDecisions } from "./components/critical-decisions";
import { ExecutiveBriefing } from "./components/executive-briefing";
import { ExecutiveMemory } from "./components/executive-memory";
import { OperatingHealth } from "./components/operating-health";
import { PortfolioOverview } from "./components/portfolio-overview";
import { SituationRoomHeader } from "./components/situation-room-header";
import { TodaysMission } from "./components/todays-mission";
import { formatBriefingDate } from "./format";
import type { SituationRoomModel } from "./types";

export function SituationRoomScreen({
  data,
  now = new Date(),
}: {
  data: SituationRoomModel;
  now?: Date;
}) {
  return (
    <section className="flex min-h-full flex-1 flex-col">
      <div className="ids-surface-section vos-screen mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-8">
        <SituationRoomHeader
          founderName={data.header.founderName}
          posture={data.header.posture}
          worldLine={data.header.worldLine}
          dateLabel={formatBriefingDate(now)}
        />
        <TodaysMission mission={data.mission} />
        <ExecutiveBriefing briefing={data.briefing} />
        <OperatingHealth health={data.health} />
        <CriticalDecisions decisions={data.decisions} />
        <PortfolioOverview companies={data.portfolio} />
        <CompanyStoryHighlights stories={data.stories} />
        <ExecutiveMemory items={data.memory} />
      </div>
    </section>
  );
}
