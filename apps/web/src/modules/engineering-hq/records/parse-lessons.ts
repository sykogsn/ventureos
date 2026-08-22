import type { LessonRecord } from "../types";
import { headingIdAndTitle, splitMarkdownSections } from "./markdown";

function field(body: string, label: string) {
  const match = body.match(new RegExp(`\\*\\*${label}\\.\\*\\*\\s*(.+)`));
  return match?.[1]?.trim() ?? "";
}

function categoryFor(sprint: string) {
  if (sprint.includes("VS-005")) {
    return "History";
  }
  if (sprint.includes("VS-008")) {
    return "Governance";
  }
  if (sprint.includes("VS-007")) {
    return "Foundation recovery";
  }
  return "Engineering";
}

export function parseLessonsLearned(markdown: string): LessonRecord[] {
  return splitMarkdownSections(markdown, /^## LL-/).map((section) => {
    const parsed = headingIdAndTitle(section.heading);
    const sprint = field(section.body, "Sprint");
    const date = field(section.body, "Date") || "Not recorded";
    const body = section.body
      .replace(/\*\*Sprint\.\*\*.+\n?/, "")
      .replace(/\*\*Date\.\*\*.+\n?/, "")
      .trim();

    return {
      id: parsed.id,
      title: parsed.title,
      sprint,
      date,
      category: categoryFor(sprint),
      body,
    };
  });
}
