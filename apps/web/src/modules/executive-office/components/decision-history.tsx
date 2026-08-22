import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { DecisionRecord } from "../types";
import { Stack, StackList } from "@/core/layout";

export function DecisionHistory({ items }: { items: DecisionRecord[] }) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Decision history</p>
        <p className="ids-caption">Rulings this office already made.</p>
      </Stack>
      {items.length === 0 ? (
        <EmptyCopy title="No activity">
          Decisions you make from this office will be recorded here.
        </EmptyCopy>
      ) : (
        <StackList>
          {items.map((item) => (
            <li key={item.id}>
              <Stack gap="tight">
                <p className="ids-caption">{item.date}</p>
                <h3 className="ids-label">{item.title}</h3>
                <p className="ids-body text-foreground">
                  <span className="ids-emphasis">Ruling. </span>
                  {item.ruling}
                </p>
                <p className="ids-body text-muted">{item.result}</p>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </SectionCard>
  );
}
