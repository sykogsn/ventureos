import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterKnowledge, parseKnowledgeFilter, searchBrain } from "./query";

describe("Brain catalogue query", () => {
  it("filters by type and keeps unknown filters empty", () => {
    const filter = parseKnowledgeFilter({ type: "Constitution", status: "not-a-status" });
    assert.equal(filter.type, "Constitution");
    assert.equal(filter.status, "");
    const rows = filterKnowledge(filter);
    assert.ok(rows.length >= 1);
    assert.ok(rows.every((item) => item.type === "Constitution"));
  });

  it("searches the single catalogue without a parallel decision index", () => {
    const hits = searchBrain("orchestrator");
    assert.ok(hits.some((item) => item.id === "runtime"));
    assert.ok(hits.some((item) => item.id === "adr-001" && item.type === "Decision"));
    assert.ok(hits.every((item) => item.href.startsWith("/brain/library/")));
    assert.deepEqual(searchBrain("   "), []);
  });
});
