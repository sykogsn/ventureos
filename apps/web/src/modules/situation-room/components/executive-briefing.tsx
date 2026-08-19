import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { ExecutiveBriefing } from "../types";

export function ExecutiveBriefing({ briefing }: { briefing: ExecutiveBriefing }) {
  return (
    <SectionCard>
      <div>
        <p className="ids-kicker">Executive briefing</p>
        <p className="ids-caption mt-1">{briefing.preparedBy}</p>
      </div>
      <div className="max-w-[42rem]">
        <h2 className="ids-subhead">{briefing.headline}</h2>
        <p className="ids-body mt-3 text-muted">{briefing.narrative}</p>
      </div>
      {briefing.implications.length === 0 ? (
        <EmptyCopy title="The briefing is still forming">
          Policy evaluation writes implications after a company is in motion. Found a company to
          begin the daily brief.
        </EmptyCopy>
      ) : (
        <ol className="flex flex-col gap-3 border-t border-border pt-5">
          {briefing.implications.map((item, index) => (
            <li key={item.id} className="grid grid-cols-[1.5rem_1fr] gap-2">
              <span className="ids-caption tabular-nums">{index + 1}.</span>
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
        </ol>
      )}
    </SectionCard>
  );
}
