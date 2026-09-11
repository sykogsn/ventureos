import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { getPlatform } from "../../platform/kernel";
import { ensureSchema } from "../../platform/persistence/db";
import { resetPersistenceLifecycle } from "../../platform/persistence/repositories/sqlite";
import { registerUser } from "../auth/service";
import { createVenture } from "../ventures/service";
import { createWorkspace } from "../workspaces/service";
import { executeIntelligenceRuntime, loadVentureIntelligence } from "./service";

describe("Navigation intelligence cost", () => {
  after(() => {
    getPlatform().scheduler.stopAll();
  });

  beforeEach(async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
  });

  it("records uncached Runtime read cost for the navigation report", async () => {
    const user = await registerUser({
      email: "nav-cost@ventureos.test",
      password: "desk-password",
      name: "Founder",
    });
    const workspace = await createWorkspace({
      userId: user.id,
      name: "Cost Desk",
    });
    await createVenture({
      userId: user.id,
      workspaceId: workspace.id,
      name: "Cost Company",
    });

    const firstRuntimeStarted = performance.now();
    const firstRuntime = await executeIntelligenceRuntime({
      userId: user.id,
      workspaceId: workspace.id,
    });
    const firstRuntimeMs = performance.now() - firstRuntimeStarted;

    const secondRuntimeStarted = performance.now();
    const secondRuntime = await executeIntelligenceRuntime({
      userId: user.id,
      workspaceId: workspace.id,
    });
    const secondRuntimeMs = performance.now() - secondRuntimeStarted;

    const firstReadStarted = performance.now();
    const firstRead = await loadVentureIntelligence(user.id, workspace.id);
    const firstReadMs = performance.now() - firstReadStarted;

    const secondReadStarted = performance.now();
    const secondRead = await loadVentureIntelligence(user.id, workspace.id);
    const secondReadMs = performance.now() - secondReadStarted;

    assert.ok(firstRuntime);
    assert.ok(secondRuntime);
    assert.ok(firstRead);
    assert.ok(secondRead);
    assert.equal(firstRead.ventures.length, secondRead.ventures.length);
    console.log(
      `navigation-cost runtime1=${firstRuntimeMs.toFixed(1)}ms runtime2=${secondRuntimeMs.toFixed(1)}ms duplicate=${(firstRuntimeMs + secondRuntimeMs).toFixed(1)}ms read1=${firstReadMs.toFixed(1)}ms read2=${secondReadMs.toFixed(1)}ms`,
    );
  });
});
