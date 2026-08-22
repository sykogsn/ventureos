import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { CorrespondenceNote } from "../types";
import { Hairline, RankedList, Stack } from "@/core/layout";

export function ConversationPanel({ notes }: { notes: CorrespondenceNote[] }) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Conversation</p>
        <p className="ids-caption">A record of notes on this floor — not a live chat.</p>
      </Stack>
      {notes.length === 0 ? (
        <EmptyCopy title="No activity">
          Notes appear here as a record, never as a live chat.
        </EmptyCopy>
      ) : (
        <Hairline space="compact">
          <RankedList>
            {notes.map((note) => (
              <li key={note.id}>
                <Stack gap="tight">
                  <p className="ids-caption">
                    {note.at} · {note.author}
                  </p>
                  <p className="ids-body text-foreground">{note.body}</p>
                </Stack>
              </li>
            ))}
          </RankedList>
        </Hairline>
      )}
    </SectionCard>
  );
}
