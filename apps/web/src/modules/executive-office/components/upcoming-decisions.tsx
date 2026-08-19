import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { UpcomingDecision } from "../types";

export function UpcomingDecisions({ items }: { items: UpcomingDecision[] }) {
  return (
    <SectionCard>
      <div>
        <p className="ids-kicker">Upcoming decisions</p>
        <p className="ids-caption mt-1">Calls still on this desk.</p>
      </div>
      {items.length === 0 ? (
        <EmptyCopy title="Nothing is scheduled">
          When the office has a call for you, it will appear on this desk.
        </EmptyCopy>
      ) : (
      <ul className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="ids-caption">{item.company}</p>
              <p className="ids-caption">{item.due}</p>
            </div>
            <p className="ids-label mt-2">{item.question}</p>
          </li>
        ))}
      </ul>
      )}
    </SectionCard>
  );
}
