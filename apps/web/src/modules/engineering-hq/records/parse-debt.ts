import type { DebtRecord } from "../types";
import { headingIdAndTitle, parseFieldTable, splitMarkdownSections } from "./markdown";

export function parseDebtRegister(markdown: string): DebtRecord[] {
  return splitMarkdownSections(markdown, /^## ERT-/).map((section) => {
    const fields = parseFieldTable(section.body);
    const parsed = headingIdAndTitle(section.heading);
    return {
      id: fields.ID ?? parsed.id,
      title: parsed.title,
      priority: fields.Priority ?? "",
      description: fields.Description ?? "",
      impact: fields.Impact ?? "",
      owner: "Engineering",
      sprint: fields["Planned Sprint"] ?? "Not assigned",
      status: fields.Status ?? "",
    };
  });
}
