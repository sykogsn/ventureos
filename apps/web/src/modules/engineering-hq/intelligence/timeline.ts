import type { EngineeringCatalogue } from "../types";
import type { TimelineEvent } from "./types";

export function analyseTimeline(catalogue: EngineeringCatalogue): TimelineEvent[] {
  return catalogue.sprints.map((sprint) => ({
    id: sprint.id,
    title: sprint.title,
    date: sprint.completion,
    status: sprint.status,
    summary: sprint.summary,
    searchText: [
      sprint.id,
      sprint.title,
      sprint.status,
      sprint.objective,
      sprint.summary,
      sprint.completion,
      sprint.bucket,
    ]
      .join(" ")
      .toLowerCase(),
  }));
}

export function filterTimeline(events: TimelineEvent[], query: string): TimelineEvent[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return events;
  }
  return events.filter((event) => event.searchText.includes(needle));
}
