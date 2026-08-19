import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { TodaysBrief } from "../types";

export function TodaysBrief({ brief }: { brief: TodaysBrief }) {
  return (
    <SectionCard>
      <p className="ids-kicker">Today’s brief</p>
      <h2 className="ids-lead max-w-[40rem]">{brief.headline}</h2>
      <p className="ids-body max-w-[42rem] text-muted">{brief.body}</p>
      <p className="ids-body max-w-[42rem] text-foreground">
        <span className="ids-emphasis">Focus. </span>
        {brief.focus}
      </p>
    </SectionCard>
  );
}
