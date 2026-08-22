import { Cluster, Field, Form, ReadingRegion, Stack, StackList } from "@/core/layout";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { EngineeringCatalogue, SprintBucket, SprintRecord } from "../types";
import type { EngineeringIntelligence, TimelineEvent } from "../intelligence/types";
import { EngineeringFrame } from "../components/engineering-frame";
import { StatusLamp } from "../components/status-lamp";

const groups: { bucket: SprintBucket; title: string; description: string }[] = [
  {
    bucket: "current",
    title: "Current sprint",
    description: "Only programmes still in progress on ENGINEERING_HISTORY.md.",
  },
  {
    bucket: "completed",
    title: "Completed sprints",
    description: "Parsed from ENGINEERING_HISTORY.md.",
  },
  {
    bucket: "upcoming",
    title: "Upcoming sprints",
    description: "Named in the history close-out. No invented VS numbers.",
  },
];

function toneFor(sprint: SprintRecord) {
  if (sprint.bucket === "completed") {
    return "healthy" as const;
  }
  return "watch" as const;
}

function SprintList({ items }: { items: SprintRecord[] }) {
  return (
    <StackList>
      {items.map((sprint) => (
        <li key={`${sprint.bucket}-${sprint.id}`}>
          <Stack gap="tight">
            <Cluster justify="start">
              <p className="ids-caption">{sprint.id}</p>
              <StatusLamp tone={toneFor(sprint)}>{sprint.status}</StatusLamp>
            </Cluster>
            <h2 className="ids-label text-foreground">{sprint.title}</h2>
            <p className="ids-body text-muted">{sprint.objective}</p>
            <p className="ids-caption">Completion: {sprint.completion}</p>
            <p className="ids-body text-muted">{sprint.summary}</p>
          </Stack>
        </li>
      ))}
    </StackList>
  );
}

export function EngineeringSprintsScreen({
  catalogue,
  intelligence,
  query,
  timeline,
}: {
  catalogue: EngineeringCatalogue;
  intelligence: EngineeringIntelligence;
  query: string;
  timeline: TimelineEvent[];
}) {
  return (
    <EngineeringFrame
      page="Sprints"
      title="Sprint Centre"
      description="Sprint intelligence and timeline from ENGINEERING_HISTORY.md. Search is ready for later Git overlays."
    >
      <SectionCard title="Sprint intelligence">
        <Stack gap="tight">
          <p className="ids-body text-foreground">
            Current: {intelligence.sprints.currentId}. Phase: {intelligence.sprints.currentPhase}.
            Completed: {intelligence.sprints.completedCount}. Milestone:{" "}
            {intelligence.sprints.latestMilestone}. Next: {intelligence.sprints.nextPlanned}.
          </p>
          {intelligence.sprints.evidence.map((line) => (
            <p key={line} className="ids-caption">
              {line}
            </p>
          ))}
        </Stack>
      </SectionCard>

      <ReadingRegion size="lg">
        <Form gap="compact" method="get" action="/engineering/sprints">
          <Field>
            Filter timeline
            <input
              className="vos-field"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="VS-007, certified, HQ"
            />
          </Field>
          <div>
            <button type="submit" className="vos-btn-secondary">
              Filter
            </button>
          </div>
        </Form>
      </ReadingRegion>

      <SectionCard title="Engineering timeline" description="Generated from Engineering History.">
        <StackList>
          {timeline.map((event) => (
            <li key={event.id}>
              <Stack gap="tight">
                <Cluster justify="start">
                  <p className="ids-caption">{event.id}</p>
                  <p className="ids-caption">{event.date}</p>
                </Cluster>
                <p className="ids-label text-foreground">{event.title}</p>
                <p className="ids-caption">{event.status}</p>
                <p className="ids-body text-muted">{event.summary}</p>
              </Stack>
            </li>
          ))}
        </StackList>
      </SectionCard>

      {groups.map((group) => {
        const items = catalogue.sprints.filter((item) => item.bucket === group.bucket);
        return (
          <SectionCard key={group.bucket} title={group.title} description={group.description}>
            {items.length === 0 ? (
              <p className="ids-body text-muted">Unknown. None recorded on the ledger.</p>
            ) : (
              <SprintList items={items} />
            )}
          </SectionCard>
        );
      })}
    </EngineeringFrame>
  );
}
