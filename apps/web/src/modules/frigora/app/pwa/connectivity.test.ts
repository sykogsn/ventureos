import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldBlockFrigoraFieldMutation } from "./connectivity";

describe("Frigora F3.2 connectivity", () => {
  it("blocks field mutations only while disconnected on field surfaces", () => {
    assert.equal(shouldBlockFrigoraFieldMutation(false, "/frigora"), true);
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/assigned"),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/wo-1/visit/vis-1"),
      true,
    );
    assert.equal(shouldBlockFrigoraFieldMutation(true, "/frigora"), false);
    assert.equal(
      shouldBlockFrigoraFieldMutation(true, "/ventures/ven-1/work/assigned"),
      false,
    );
    assert.equal(shouldBlockFrigoraFieldMutation(false, "/dashboard"), false);
    assert.equal(shouldBlockFrigoraFieldMutation(false, "/login"), false);
  });
});
