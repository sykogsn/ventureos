import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { CorrespondenceNote } from "../types";

export function ConversationPanel({ notes }: { notes: CorrespondenceNote[] }) {
  return (
    <SectionCard className="lg:sticky lg:top-6">
      <div>
        <p className="ids-kicker">Conversation</p>
        <p className="ids-caption mt-1">
          A record of notes on this floor — not a live chat.
        </p>
      </div>
      {notes.length === 0 ? (
        <EmptyCopy title="A quiet floor">
          Notes appear here as a record, never as a live chat.
        </EmptyCopy>
      ) : (
      <ol className="flex flex-col gap-4 border-t border-border pt-4">
        {notes.map((note) => (
          <li key={note.id}>
            <p className="ids-caption">
              {note.at} · {note.author}
            </p>
            <p className="ids-body mt-2 text-foreground">{note.body}</p>
          </li>
        ))}
      </ol>
      )}
    </SectionCard>
  );
}
