import type { DecisionRecord } from "../types";
import { headingIdAndTitle, parseFieldTable, splitMarkdownSections } from "./markdown";

export function parseDecisionRegister(markdown: string): DecisionRecord[] {
  return splitMarkdownSections(markdown, /^## ERD-/).map((section) => {
    const fields = parseFieldTable(section.body);
    const parsed = headingIdAndTitle(section.heading);
    return {
      id: fields["Decision ID"] ?? parsed.id,
      title: fields.Title ?? parsed.title,
      problem: fields.Problem ?? "",
      decision: fields.Decision ?? "",
      reason: fields.Reason ?? "",
      outcome: fields.Outcome ?? "",
      status: fields.Status ?? "",
    };
  });
}
