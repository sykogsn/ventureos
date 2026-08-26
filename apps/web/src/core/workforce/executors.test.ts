import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOUNDER_ONLY_CAPABILITIES } from "./authority";
import {
  createExecutionProbeExecutor,
  createWorkforceExecutorRegistry,
  EXECUTION_PROBE_CAPABILITY_ID,
} from "./executors";
import type { CapabilityExecutor, ExecutorInvocation } from "./types";

describe("workforce executor registry", () => {
  it("rejects registering governance.founder-decision", () => {
    const rogue: CapabilityExecutor = {
      id: FOUNDER_ONLY_CAPABILITIES[0],
      parseArguments: () => ({ ok: true, value: {} }),
      async execute() {
        return { executorId: FOUNDER_ONLY_CAPABILITIES[0], ok: true };
      },
    };

    assert.throws(
      () => createWorkforceExecutorRegistry([rogue]),
      /Executor registration forbidden/,
    );
  });

  it("rejects duplicate executor ids", () => {
    const probe = createExecutionProbeExecutor();
    assert.throws(
      () => createWorkforceExecutorRegistry([probe.executor, probe.executor]),
      /Duplicate executor/,
    );
  });

  it("does not look up executors by arbitrary strings", () => {
    const probe = createExecutionProbeExecutor();
    const registry = createWorkforceExecutorRegistry([probe.executor]);
    assert.equal(registry.get(EXECUTION_PROBE_CAPABILITY_ID)?.id, EXECUTION_PROBE_CAPABILITY_ID);
    assert.equal(registry.get("intelligence.knowledge-graph"), undefined);
    assert.equal(registry.get("../secret"), undefined);
  });

  it("keeps the probe set-once per execution identity", async () => {
    const probe = createExecutionProbeExecutor();
    const request: ExecutorInvocation = {
      executionId: "exec-1",
      actor: {
        kind: "agent",
        agentInstanceId: "instance-1" as ExecutorInvocation["agentInstanceId"],
        workspaceId: "ws-1" as ExecutorInvocation["workspaceId"],
        ventureId: "venture-1" as ExecutorInvocation["ventureId"],
      },
      agentInstanceId: "instance-1" as ExecutorInvocation["agentInstanceId"],
      workspaceId: "ws-1" as ExecutorInvocation["workspaceId"],
      ventureId: "venture-1" as ExecutorInvocation["ventureId"],
      capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      arguments: {},
    };

    await probe.executor.execute(request);
    await probe.executor.execute(request);
    assert.equal(probe.invocationCount(), 1);
  });
});
