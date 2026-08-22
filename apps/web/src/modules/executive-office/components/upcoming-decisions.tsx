import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { UpcomingDecision } from "../types";
import { Cluster, Stack, StackList } from "@/core/layout";

export function UpcomingDecisions({ items }: { items: UpcomingDecision[] }) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Upcoming decisions</p>
        <p className="ids-caption">Calls still on this desk.</p>
      </Stack>
      {items.length === 0 ? (
        <EmptyCopy title="No call is waiting">
          When the office has a call for you, it will appear on this desk.
        </EmptyCopy>
      ) : (
        <StackList>
          {items.map((item) => (
            <li key={item.id}>
              <Stack gap="tight">
                <Cluster justify="between">
                  <p className="ids-caption">{item.company}</p>
                  <p className="ids-caption">{item.due}</p>
                </Cluster>
                <p className="ids-label">{item.question}</p>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </SectionCard>
  );
}
