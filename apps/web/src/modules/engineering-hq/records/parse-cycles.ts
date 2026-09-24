import type {
  CycleClosedAs,
  CycleEvidenceRecord,
  CycleOwnershipClass,
  CycleTernary,
} from "../types";
import { headingIdAndTitle, parseFieldTable, splitMarkdownSections } from "./markdown";

function unknownToNull(value: string | undefined): string | null {
  if (!value || /^unknown$/i.test(value)) {
    return null;
  }
  return value;
}

function parseCount(value: string | undefined): number | null {
  const raw = unknownToNull(value);
  if (raw === null) {
    return null;
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  return Number(raw);
}

function parseOwnership(value: string | undefined): CycleOwnershipClass | null {
  const raw = unknownToNull(value);
  if (raw === "A" || raw === "B" || raw === "C" || raw === "D") {
    return raw;
  }
  return null;
}

function parseClosedAs(value: string | undefined): CycleClosedAs | null {
  const raw = unknownToNull(value)?.toLowerCase();
  if (raw === "certified" || raw === "stopped" || raw === "deferred") {
    return raw;
  }
  return null;
}

function parseTernary(value: string | undefined): CycleTernary {
  const raw = unknownToNull(value)?.toUpperCase();
  if (raw === "YES" || raw === "NO") {
    return raw;
  }
  return "UNKNOWN";
}

export function parseCycleEvidence(markdown: string): CycleEvidenceRecord[] {
  return splitMarkdownSections(markdown, /^## ECE-/).map((section) => {
    const fields = parseFieldTable(section.body);
    const parsed = headingIdAndTitle(section.heading);
    return {
      id: fields["Cycle ID"] ?? parsed.id,
      title: fields.Title ?? parsed.title,
      scope: fields.Scope ?? "",
      ownershipClass: parseOwnership(fields["Ownership class"]),
      workItem: fields["Work item"] ?? "",
      checkpointSha: unknownToNull(fields["Checkpoint SHA"]),
      erdRef: unknownToNull(fields.ERD),
      llRef: unknownToNull(fields.LL),
      openedAt: unknownToNull(fields.Opened),
      closedAt: unknownToNull(fields.Closed),
      closedAs: parseClosedAs(fields["Closed as"]),
      diagnosticCycles: parseCount(fields["Diagnostic cycles"]),
      correctionAttempts: parseCount(fields["Correction attempts"]),
      failedCorrections: parseCount(fields["Failed corrections"]),
      targetedTestRuns: parseCount(fields["Targeted test runs"]),
      relatedDomainTestRuns: parseCount(fields["Related domain test runs"]),
      fullSuiteRuns: parseCount(fields["Full-suite runs"]),
      certificationFailures: parseCount(fields["Certification failures"]),
      regressionsFound: parseCount(fields["Regressions found"]),
      manualFounderInterventions: parseCount(fields["Manual founder interventions"]),
      manualTerminalInterventions: parseCount(fields["Manual terminal interventions"]),
      tests: parseCount(fields.Tests),
      pass: parseCount(fields.Pass),
      fail: parseCount(fields.Fail),
      cancelled: parseCount(fields.Cancelled),
      skipped: parseCount(fields.Skipped),
      exitCode: parseCount(fields["Exit code"]),
      cleanProcessExit: parseTernary(fields["Clean process exit"]),
      failureClass: unknownToNull(fields["Failure class"]),
      firstCorrectionHeld: parseTernary(fields["First correction held"]),
      notes: fields.Notes ?? "",
    };
  });
}
