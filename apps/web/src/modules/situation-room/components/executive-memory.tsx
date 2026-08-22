import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { MemoryItem } from "../types";
import { ReadingRegion, Stack, StackList } from "@/core/layout";

export function ExecutiveMemory({ items }: { items: MemoryItem[] }) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Executive memory</p>
        <p className="ids-caption">Decisions you already made. Do not reopen them today.</p>
      </Stack>
      {items.length === 0 ? (
        <EmptyCopy title="No activity">
          Recorded founder decisions will rest here so they are not reopened today.
        </EmptyCopy>
      ) : (
        <StackList>
          {items.map((item) => (
            <li key={item.id}>
              <Stack gap="tight">
                <p className="ids-caption">Recalled from {item.recalledFrom}</p>
                <h3 className="ids-label text-foreground">{item.title}</h3>
                <ReadingRegion size="lg">
                  <Stack gap="tight">
                    <p className="ids-body text-muted">{item.note}</p>
                    <p className="ids-body text-foreground">{item.implication}</p>
                  </Stack>
                </ReadingRegion>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </SectionCard>
  );
}
