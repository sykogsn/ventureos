import type { CertificationSnapshot, HealthTone } from "../types";
import { parseTwoColumnRows } from "./markdown";

function gateTone(result: string): HealthTone {
  if (!result) {
    return "unknown";
  }
  if (/no script/i.test(result)) {
    return "watch";
  }
  if (/pass/i.test(result)) {
    return "healthy";
  }
  if (/fail|error/i.test(result)) {
    return "risk";
  }
  return "unknown";
}

function parseOutstanding(markdown: string): string[] {
  const section =
    markdown.split("## Remaining Follow-up Items")[1]?.split("## ")[0] ?? "";
  return section
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\d+\.\s+(.+)/);
      return match?.[1] ? [match[1].trim()] : [];
    });
}

export function parseCertification(markdown: string): CertificationSnapshot {
  const status =
    markdown.match(/\*\*Certification status\.\*\*\s*(.+)/)?.[1]?.trim() ??
    "Unknown";
  const date =
    markdown.match(/\*\*Date recorded\.\*\*\s*(.+)/)?.[1]?.trim() ?? "Unknown";
  const programme =
    markdown.match(/\*\*Programme\.\*\*\s*(.+)/)?.[1]?.trim() ?? "Unknown";
  const version =
    markdown.match(/^#\s+Foundation Certification\s+(v[\d.]+)/m)?.[1] ??
    "Unknown";
  const recommendation =
    markdown.split("## Recommendation")[1]?.split("## ")[0]?.trim() ?? "Unknown";

  const gatesSection =
    markdown.split("## Quality Gates")[1]?.split("## ")[0] ?? "";
  const architectureSection =
    markdown.split("## Architecture Summary")[1]?.split("## ")[0] ?? "";

  return {
    status,
    date,
    programme,
    version,
    outstanding: parseOutstanding(markdown),
    recommendation,
    gates: parseTwoColumnRows(gatesSection, "Gate", "Result").map((row) => ({
      gate: row.left,
      result: row.right,
      tone: gateTone(row.right),
    })),
    architecture: parseTwoColumnRows(
      architectureSection,
      "Concern",
      "Status at certification",
    ).map((row) => ({
      concern: row.left,
      status: row.right,
    })),
  };
}
