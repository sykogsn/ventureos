import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { brandFromDefinitionId } from "@repo/ids/themes/bind";

describe("IDS brand bind", () => {
  it("fails closed to VentureOS", () => {
    assert.equal(brandFromDefinitionId(undefined), "ventureos");
    assert.equal(brandFromDefinitionId("ventureos.company"), "ventureos");
  });
});
