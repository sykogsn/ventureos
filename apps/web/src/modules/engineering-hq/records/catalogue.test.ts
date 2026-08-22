import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadEngineeringCatalogue } from "./catalogue";
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
    assert.equal(catalogue.decisions.length, 7);
    assert.equal(catalogue.debt.length, 5);
    assert.equal(catalogue.lessons.length, 7);
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
});
