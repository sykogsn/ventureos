import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FRIGORA_F33_OFFLINE_RUNTIME_ENABLED } from "@/modules/frigora/app/offline/runtime-gate";
import {
  resolveConnectivityStatusLabel,
  shouldBlockFrigoraFieldMutation,
} from "./connectivity";

describe("Frigora F3.2 connectivity", () => {
  it("quarantines F3.3 runtime capability while F3.2 is active", () => {
    assert.equal(FRIGORA_F33_OFFLINE_RUNTIME_ENABLED, false);
  });

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
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/assigned", {
        operationType: "recordTechnicalFinding",
      }),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/assigned", {
        operationType: "recordPartUsage",
      }),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/wo-1/visit/vis-1", {
        operationType: "recordFieldCapture",
      }),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/wo-1/visit/vis-1", {
        operationType: "recordVisitEvidence",
      }),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/wo-1/visit/vis-1", {
        operationType: "removeVisitEvidence",
      }),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/wo-1/visit/vis-1", {
        operationType: "linkVisitEvidence",
      }),
      true,
    );
  });

  it("does not claim saved-on-device without durable pending operations", () => {
    assert.equal(resolveConnectivityStatusLabel({ online: false }), "offline");
    assert.equal(
      resolveConnectivityStatusLabel({
        online: false,
        queue: {
          pendingCount: 0,
          syncingCount: 0,
          blockedCount: 0,
          conflictCount: 0,
          retryableFailureCount: 0,
          syncedCount: 0,
          label: "offline",
        },
      }),
      "offline",
    );
    assert.equal(
      resolveConnectivityStatusLabel({
        online: false,
        queue: {
          pendingCount: 2,
          syncingCount: 0,
          blockedCount: 0,
          conflictCount: 0,
          retryableFailureCount: 0,
          syncedCount: 0,
          label: "saved_on_device",
        },
      }),
      "offline",
    );
  });
});
