import type { SprintRecord } from "../types";
import { headingIdAndTitle, parseFieldTable, splitMarkdownSections } from "./markdown";

function parseUpcoming(note: string): SprintRecord[] {
  const items: SprintRecord[] = [];
  if (/Engineering HQ/i.test(note)) {
    items.push({
      id: "Engineering HQ",
      title: "Engineering HQ",
      objective: "Named in ENGINEERING_HISTORY.md close-out.",
      status: "Not started",
      completion: "Not recorded",
      summary: note,
      bucket: "upcoming",
      source: "engineering-history",
    });
  }
  if (/RM-002/i.test(note) || /Qualora/i.test(note)) {
    items.push({
      id: "RM-002–RM-004",
      title: "Qualora, Calviora, and Farmora visual programmes",
      objective:
        "Remain on the Foundation Library roadmap. Not opened by this history.",
      status: "Not opened",
      completion: "Not recorded",
      summary: note,
      bucket: "upcoming",
      source: "engineering-history",
    });
  }
  return items;
}

export function parseEngineeringHistory(markdown: string): {
  sprints: SprintRecord[];
  upcomingNote: string;
} {
  const upcomingMatch = markdown.match(
    /## Not on this ledger yet\s+([\s\S]+)$/,
  );
  const upcomingNote = upcomingMatch?.[1]?.trim() ?? "";

  const sprints: SprintRecord[] = [];

  for (const section of splitMarkdownSections(markdown, /^## VS-/)) {
    const fields = parseFieldTable(section.body);
    const parsed = headingIdAndTitle(section.heading);
    const id = fields["Sprint ID"] ?? parsed.id;
    if (!id.startsWith("VS-")) {
      continue;
    }

    const status = fields.Status ?? "";
    const complete = /complete|certified/i.test(status);

    sprints.push({
      id,
      title: fields.Title ?? parsed.title,
      objective: fields.Objective ?? "",
      status,
      completion: fields["Completion Date"] ?? "Unknown",
      summary: fields.Summary ?? "",
      bucket: complete ? "completed" : "current",
      source: "engineering-history",
    });
  }

  return {
    sprints: [...sprints, ...parseUpcoming(upcomingNote)],
    upcomingNote,
  };
}
