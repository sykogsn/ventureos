import type { ReleaseRecord } from "../types";
import { parseFieldTable, splitMarkdownSections } from "./markdown";

function parseLineageTable(markdown: string): ReleaseRecord[] {
  const section =
    markdown.split("## Earlier declared lineage")[1]?.split("## ")[0] ?? "";
  const rows: ReleaseRecord[] = [];

  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4 || cells[0] === "Version" || /^[-:]+$/.test(cells[0] ?? "")) {
      continue;
    }
    rows.push({
      name: cells[1] ?? cells[0] ?? "",
      status: cells[2] ?? "",
      date: cells[3] ?? "",
      notes: `Release Register ${cells[0]}`,
    });
  }

  return rows;
}

export function parseReleaseHistory(markdown: string): ReleaseRecord[] {
  const named = splitMarkdownSections(markdown, /^## Foundation /).flatMap(
    (section) => {
      const fields = parseFieldTable(section.body);
      if (!fields.Name && !fields.Status) {
        return [];
      }
      return [
        {
          name: fields.Name ?? section.heading,
          status: fields.Status ?? "",
          date: fields.Date ?? "",
          notes: fields.Notes ?? "",
        },
      ];
    },
  );

  return [...named, ...parseLineageTable(markdown)];
}
