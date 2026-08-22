import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { ExecutiveBriefing } from "../types";
import { Hairline, RankedList, ReadingRegion, Stack } from "@/core/layout";

export function ExecutiveBriefing({ briefing }: { briefing: ExecutiveBriefing }) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Executive briefing</p>
        <p className="ids-caption">{briefing.preparedBy}</p>
      </Stack>
      <ReadingRegion size="lg">
        <Stack gap="compact">
          <h2 className="ids-subhead">{briefing.headline}</h2>
          <p className="ids-body text-muted">{briefing.narrative}</p>
        </Stack>
      </ReadingRegion>
      {briefing.implications.length === 0 ? (
        <EmptyCopy title="No intelligence available">
          Policy evaluation writes implications after a company is in motion. The daily brief
          will fill as the company operates.
        </EmptyCopy>
      ) : (
        <Hairline space="section">
          <RankedList>
            {briefing.implications.map((item, index) => (
              <li key={item.id}>
                <span className="ids-caption tabular-nums">{index + 1}. </span>
                <p className="ids-body">
                  {item.kind ? (
                    <span className="ids-emphasis text-foreground">
                      {item.kind === "opportunity"
                        ? "Opportunity"
                        : item.kind === "risk"
                          ? "Risk"
                          : "Outcome"}
                      .{" "}
                    </span>
                  ) : null}
                  <span className="ids-emphasis text-foreground">{item.company}. </span>
                  <span className="text-muted">{item.point}</span>
                </p>
              </li>
            ))}
          </RankedList>
        </Hairline>
      )}
    </SectionCard>
  );
}
