import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { MemoryItem } from "../types";

export function ExecutiveMemory({ items }: { items: MemoryItem[] }) {
  return (
    <SectionCard>
      <div>
        <p className="ids-kicker">Executive memory</p>
        <p className="ids-caption mt-1">
          What this office refuses to forget — and will not reopen.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyCopy title="No activity">
          This office will remember what you already decided — so you do not decide it twice.
        </EmptyCopy>
      ) : (
      <ul className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
          >
            <p className="ids-caption">Recalled from {item.recalledFrom}</p>
            <h3 className="ids-label mt-2">{item.title}</h3>
            <p className="ids-body mt-2 max-w-[42rem] text-muted">{item.note}</p>
            <p className="ids-body mt-2 max-w-[42rem] text-foreground">{item.implication}</p>
          </li>
        ))}
      </ul>
      )}
    </SectionCard>
  );
}
