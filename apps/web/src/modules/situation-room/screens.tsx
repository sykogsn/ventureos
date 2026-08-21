import { CompanyStoryHighlights } from "./components/company-story-highlights";
import { CriticalDecisions } from "./components/critical-decisions";
import { ExecutiveBriefing } from "./components/executive-briefing";
import { ExecutiveMemory } from "./components/executive-memory";
import { OperatingHealth } from "./components/operating-health";
import { PortfolioOverview } from "./components/portfolio-overview";
import { TodaysMission } from "./components/todays-mission";
import { formatBriefingDate } from "./format";
import type { SituationRoomModel } from "./types";
import { PageFrame } from "@/core";

export function SituationRoomScreen({
  data,
  now = new Date(),
}: {
  data: SituationRoomModel;
  now?: Date;
}) {
  return (
    <PageFrame
      page="Situation Room"
      kicker={`Daily briefing · ${data.header.founderName}`}
      title="Situation Room"
      lede={data.header.posture}
      description={data.header.worldLine}
      meta={formatBriefingDate(now)}
      summary={<TodaysMission mission={data.mission} />}
    >
      <ExecutiveBriefing briefing={data.briefing} />
      <OperatingHealth health={data.health} />
      <CriticalDecisions decisions={data.decisions} />
      <PortfolioOverview companies={data.portfolio} />
      <CompanyStoryHighlights stories={data.stories} />
      <ExecutiveMemory items={data.memory} />
    </PageFrame>
  );
}
