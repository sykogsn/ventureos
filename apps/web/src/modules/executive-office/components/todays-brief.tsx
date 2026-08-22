import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { TodaysBrief } from "../types";
import { ReadingRegion, Stack } from "@/core/layout";

export function TodaysBrief({ brief }: { brief: TodaysBrief }) {
  return (
    <SectionCard>
      <p className="ids-kicker">Today’s brief</p>
      <ReadingRegion size="md">
        <h2 className="ids-lead">{brief.headline}</h2>
      </ReadingRegion>
      <ReadingRegion size="lg">
        <Stack gap="compact">
          <p className="ids-body text-muted">{brief.body}</p>
          <p className="ids-body text-foreground">
            <span className="ids-emphasis">Focus. </span>
            {brief.focus}
          </p>
        </Stack>
      </ReadingRegion>
    </SectionCard>
  );
}
