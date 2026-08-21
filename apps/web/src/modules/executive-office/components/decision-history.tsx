import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { DecisionRecord } from "../types";

export function DecisionHistory({ items }: { items: DecisionRecord[] }) {
  return (
    <SectionCard>
      <div>
        <p className="ids-kicker">Decision history</p>
        <p className="ids-caption mt-1">Rulings this office already made.</p>
      </div>
      {items.length === 0 ? (
        <EmptyCopy title="No activity">
          Decisions you make from this office will be recorded here.
        </EmptyCopy>
      ) : (
      <ul className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
          >
            <p className="ids-caption">{item.date}</p>
            <h3 className="ids-label mt-2">{item.title}</h3>
            <p className="ids-body mt-2 text-foreground">
              <span className="ids-emphasis">Ruling. </span>
              {item.ruling}
            </p>
            <p className="ids-body mt-2 text-muted">{item.result}</p>
          </li>
        ))}
      </ul>
      )}
    </SectionCard>
  );
}
