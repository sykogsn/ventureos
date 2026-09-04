import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadEngineeringCatalogue } from "./catalogue";
import { parseCycleEvidence } from "./parse-cycles";
import { parseDecisionRegister } from "./parse-decisions";
import { parseEngineeringHistory } from "./parse-history";
import { parseLessonsLearned } from "./parse-lessons";

describe("Engineering Records catalogue", () => {
  it("reads live docs/engineering files", () => {
    const catalogue = loadEngineeringCatalogue();
    assert.ok(catalogue.sprints.some((item) => item.id === "VS-007"));
    assert.ok(catalogue.sprints.some((item) => item.id === "VS-008A"));
    assert.ok(catalogue.sprints.some((item) => item.id === "VS-008B"));
    assert.ok(catalogue.sprints.some((item) => item.id === "VS-008C"));
    assert.ok(!catalogue.sprints.some((item) => item.bucket === "current"));
    assert.equal(catalogue.certification.version, "v1.1");
    assert.equal(catalogue.decisions.length, 8);
    assert.equal(catalogue.debt.length, 5);
    assert.equal(catalogue.lessons.length, 8);
    assert.equal(catalogue.cycles.length, 1);
    assert.equal(catalogue.cycles[0]?.id, "ECE-001");
    assert.equal(catalogue.cycles[0]?.tests, 753);
    assert.equal(catalogue.cycles[0]?.pass, 753);
    assert.equal(catalogue.cycles[0]?.fail, 0);
    assert.equal(catalogue.cycles[0]?.diagnosticCycles, null);
    assert.equal(catalogue.cycles[0]?.correctionAttempts, null);
    assert.equal(catalogue.cycles[0]?.failedCorrections, null);
    assert.equal(catalogue.cycles[0]?.certificationFailures, null);
    assert.equal(catalogue.cycles[0]?.cleanProcessExit, "YES");
    assert.equal(catalogue.cycles[0]?.firstCorrectionHeld, "YES");
    assert.match(catalogue.certification.status, /CERTIFIED/);
    assert.ok(catalogue.releases.some((item) => item.name.includes("1.1")));
    assert.ok(catalogue.releases.some((item) => item.name.includes("1.0")));
    assert.equal(catalogue.constitution.length, 4);
  });

  it("parses a history field table without becoming a second store", () => {
    const parsed = parseEngineeringHistory(`
## VS-001 — Foundation

| Field | Record |
|---|---|
| Sprint ID | VS-001 |
| Title | Foundation |
| Objective | Lock the OS. |
| Status | Complete |
| Completion Date | 2026-08-21 |
| Summary | One orchestrator. |
`);
    assert.equal(parsed.sprints[0]?.id, "VS-001");
    assert.equal(parsed.sprints[0]?.source, "engineering-history");
  });

  it("parses decisions and lessons from record headings", () => {
    const decisions = parseDecisionRegister(`
## ERD-001 — Diagnose before implementing

| Field | Record |
|---|---|
| Decision ID | ERD-001 |
| Title | Diagnose before implementing |
| Problem | Guessing. |
| Decision | Write a diagnostic. |
| Reason | Evidence. |
| Outcome | Root cause named. |
| Status | Accepted |
`);
    assert.equal(decisions[0]?.id, "ERD-001");
    const lessons = parseLessonsLearned(`
## LL-001 — Diagnose before implementing

**Sprint.** VS-007  
**Date.** 2026-08-21

Evidence first.
`);
    assert.equal(lessons[0]?.sprint, "VS-007");
    assert.equal(lessons[0]?.category, "Foundation recovery");
  });

  it("parses cycle evidence without treating Unknown as zero", () => {
    const cycles = parseCycleEvidence(`
## ECE-002 — Stopped certification

| Field | Record |
|---|---|
| Cycle ID | ECE-002 |
| Title | Stopped certification |
| Scope | foundation |
| Ownership class | C |
| Work item | Example |
| Checkpoint SHA | Unknown |
| Opened | Unknown |
| Closed | 2026-09-04 |
| Closed as | stopped |
| Diagnostic cycles | Unknown |
| Correction attempts | 0 |
| Failed corrections | Unknown |
| Tests | 10 |
| Pass | 9 |
| Fail | 1 |
| Cancelled | 0 |
| Skipped | 0 |
| Exit code | 1 |
| Clean process exit | NO |
| Failure class | assertion |
| First correction held | UNKNOWN |
`);
    assert.equal(cycles[0]?.id, "ECE-002");
    assert.equal(cycles[0]?.checkpointSha, null);
    assert.equal(cycles[0]?.openedAt, null);
    assert.equal(cycles[0]?.diagnosticCycles, null);
    assert.equal(cycles[0]?.correctionAttempts, 0);
    assert.equal(cycles[0]?.failedCorrections, null);
    assert.equal(cycles[0]?.targetedTestRuns, null);
    assert.equal(cycles[0]?.fail, 1);
    assert.equal(cycles[0]?.cleanProcessExit, "NO");
    assert.equal(cycles[0]?.firstCorrectionHeld, "UNKNOWN");
  });
});
