export function splitMarkdownSections(markdown: string, headingPattern: RegExp) {
  const lines = markdown.split(/\r?\n/);
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    if (headingPattern.test(line)) {
      if (current) {
        sections.push({
          heading: current.heading,
          body: current.body.join("\n").trim(),
        });
      }
      current = { heading: line.replace(/^##\s+/, "").trim(), body: [] };
      continue;
    }
    if (current) {
      current.body.push(line);
    }
  }

  if (current) {
    sections.push({
      heading: current.heading,
      body: current.body.join("\n").trim(),
    });
  }

  return sections;
}

export function parseFieldTable(markdown: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) {
      continue;
    }
    const [key, value] = cells;
    if (!key || !value) {
      continue;
    }
    if (key === "Field" || key === "Record" || /^[-:]+$/.test(key)) {
      continue;
    }
    fields[key] = value;
  }

  return fields;
}

export function parseTwoColumnRows(
  markdown: string,
  headerA: string,
  headerB: string,
): { left: string; right: string }[] {
  const rows: { left: string; right: string }[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2 || !cells[0] || !cells[1]) {
      continue;
    }
    if (cells[0] === headerA || cells[1] === headerB || /^[-:]+$/.test(cells[0])) {
      continue;
    }
    rows.push({ left: cells[0], right: cells[1] });
  }

  return rows;
}

export function headingIdAndTitle(heading: string): { id: string; title: string } {
  const match = heading.match(/^([A-Z]+-\d+[A-Z]?)\s+[—-]\s+(.+)$/);
  if (match?.[1] && match[2]) {
    return { id: match[1], title: match[2] };
  }
  return { id: heading, title: heading };
}
