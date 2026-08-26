import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentDefinitionId, AgentInstanceId } from "@/contracts/ids";
import { CAPABILITY_CONTRACTS } from "@/core/capability/contracts";
import {
  platformCapabilityCatalog,
  platformCapabilityRegistry,
} from "@/core/capability/catalog";
import { createCapabilityManifest } from "@/core/capability/model";
import { createCapabilityRegistry } from "@/core/capability/registry";
import { createWorkforceExecutionStore } from "@/platform/workforce/execution-store";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { workforceExecutions as executionTable } from "@/platform/persistence/schema";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import {
  evaluateAuthority,
  type AuthorityEvaluatorDeps,
  type VentureScopePort,
} from "./authority";
import { createWorkforceDefinitionRegistry } from "./definitions";
import {
  createWorkforceExecutionGate,
  deriveExecutionIdempotencyKey,
  deriveExternalIdempotencyKey,
  hashExecutionArguments,
  SECRET_ARGUMENT_KEYS,
} from "./execution";
import {
  createExecutionProbeExecutor,
  createWorkforceExecutorRegistry,
  EXECUTION_PROBE_CAPABILITY_ID,
} from "./executors";
import { createWorkforceInstanceRegistry } from "./instances";
import type {
  AgentDefinition,
  AgentInstance,
  AgentWorkforceActor,
  CapabilityExecutor,
  ExecutionRequest,
  HumanWorkforceActor,
} from "./types";
import type { WorkforceImplementationRegistry } from "./bindings";

const userId = "user-1" as UserId;
const workspaceId = "ws-1" as WorkspaceId;
const otherWorkspaceId = "ws-2" as WorkspaceId;
const ventureId = "venture-1" as VentureId;
const otherVentureId = "venture-2" as VentureId;
const agentInstanceId = "instance-1" as AgentInstanceId;
const definitionId = "definition-1" as AgentDefinitionId;
const knownCapability = "intelligence.knowledge-graph";
const founderCapability = "governance.founder-decision";

const here = dirname(fileURLToPath(import.meta.url));
const kernelPath = join(here, "../../platform/kernel.ts");
const executionPath = join(here, "execution.ts");
const executorsPath = join(here, "executors.ts");
const storePath = join(here, "../../platform/workforce/execution-store.ts");
const modelPath = join(here, "model.ts");
const adapterPath = join(here, "../../platform/ai/openai-adapter.ts");
const typesPath = join(here, "types.ts");

let tempDir: string | undefined;

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
  if (tempDir) {
    const dir = tempDir;
    tempDir = undefined;
    await removeDir(dir);
  }
});

async function removeDir(dir: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

async function fileDatabase() {
  tempDir = await mkdtemp(join(tmpdir(), "vos-exec-gate-"));
  const path = join(tempDir, "ventureos.db").replaceAll("\\", "/");
  return `file:${path}`;
}

function agentActor(
  overrides: Partial<AgentWorkforceActor> = {},
): AgentWorkforceActor {
  return {
    kind: "agent",
    agentInstanceId,
    workspaceId,
    ventureId,
    ...overrides,
  };
}

function definition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: definitionId,
    version: "1",
    role: "Research Analyst",
    responsibilities: ["Prepare cited findings."],
    capabilityAllowList: [EXECUTION_PROBE_CAPABILITY_ID, knownCapability],
    capabilityDenyList: [founderCapability],
    autonomyCeiling: "execute",
    approvalBoundary: "",
    memoryPolicy: "run-scoped",
    escalationPolicy: "fail-run",
    evaluationProfile: "verifiedCompletion",
    lifecycle: "ACTIVE",
    ...overrides,
  };
}

function instance(overrides: Partial<AgentInstance> = {}): AgentInstance {
  return {
    id: agentInstanceId,
    definitionId,
    definitionVersion: "1",
    workspaceId,
    ventureId,
    status: "active",
    ...overrides,
  };
}

function presentScope(lifecycle = "operating"): VentureScopePort {
  return {
    async lookup() {
      return {
        ok: true,
        value: {
          workspaceFound: true,
          venture: { workspaceId, lifecycle },
        },
      };
    },
  };
}

function probeCapability() {
  return createCapabilityManifest({
    id: EXECUTION_PROBE_CAPABILITY_ID,
    name: "Workforce Execution Probe",
    classification: "Platform",
    purpose: "Test-only controlled side-effect probe for execution-gate certification.",
    owner: "platform",
    version: "0.1.0",
    maturity: "experimental",
    lifecycle: "internal",
    dependencies: [],
    provides: [CAPABILITY_CONTRACTS.capabilityRegistry],
    requires: [],
    guarantees: ["Probe invocations are counted in-process."],
    limitations: ["Not part of the production catalogue."],
  });
}

function testCapabilities() {
  return createCapabilityRegistry([...platformCapabilityCatalog, probeCapability()]);
}

function command(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    actor: agentActor(),
    agentInstanceId,
    workspaceId,
    ventureId,
    capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
    arguments: {},
    sourceRequestId: "req-1",
    sourceActionIndex: 0,
    ...overrides,
  };
}

async function setup(options: {
  definitions?: AgentDefinition[];
  instances?: AgentInstance[];
  scope?: VentureScopePort;
  capabilities?: AuthorityEvaluatorDeps["capabilities"];
  executors?: CapabilityExecutor[];
  timeoutMs?: number;
  approvals?: import("./execution").WorkforceApprovalSatisfactionPort;
  implementations?: WorkforceImplementationRegistry;
} = {}) {
  await resetPersistenceLifecycle(":memory:");
  const probe = createExecutionProbeExecutor();
  const gate = createWorkforceExecutionGate({
    definitions: createWorkforceDefinitionRegistry(
      options.definitions ?? [definition()],
    ),
    instances: createWorkforceInstanceRegistry(options.instances ?? [instance()]),
    capabilities: options.capabilities ?? testCapabilities(),
    scope: options.scope ?? presentScope(),
    executors: createWorkforceExecutorRegistry(
      options.executors ?? [probe.executor],
    ),
    store: createWorkforceExecutionStore(),
    timeoutMs: options.timeoutMs,
    approvals: options.approvals,
    implementations: options.implementations,
  });
  return { gate, probe };
}

describe("controlled execution gate", () => {
  it("permits execution after a fresh ALLOW and records contextVersion", async () => {
    const { gate, probe } = await setup();
    const result = await gate.execute(command());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.outcome.ok, true);
      assert.equal(result.reused, undefined);
      assert.ok(result.contextVersion.includes(agentInstanceId));
      assert.ok(result.evaluatedAt);
      assert.equal("VERIFIED" in result, false);
    }
    assert.equal(probe.invocationCount(), 1);
  });

  it("ignores caller-provided ALLOW, contextVersion, and idempotencyKey", async () => {
    const { gate, probe } = await setup({
      instances: [instance({ status: "disabled" })],
    });
    const forged = {
      ...command(),
      contextVersion: "forged",
      idempotencyKey: "attacker-key",
      decision: { outcome: "ALLOW" },
      context: { contextVersion: "forged" },
    } as ExecutionRequest;
    const result = await gate.execute(forged);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "AUTHORITY_DENIED");
      assert.equal(result.reason, "INSTANCE_INACTIVE");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute on DENY", async () => {
    const { gate, probe } = await setup({
      definitions: [definition({ capabilityAllowList: [knownCapability] })],
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "AUTHORITY_DENIED");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute when authority is UNAVAILABLE", async () => {
    const { gate, probe } = await setup({
      scope: {
        async lookup() {
          return { ok: false };
        },
      },
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "AUTHORITY_UNAVAILABLE");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute or fake approval on ALLOW_WITH_APPROVAL", async () => {
    const { gate, probe } = await setup({
      definitions: [definition({ autonomyCeiling: "prepare" })],
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "APPROVAL_REQUIRED");
    }
    assert.equal(probe.invocationCount(), 0);
    await ensureSchema();
    const rows = await getDb().select().from(executionTable);
    assert.equal(rows.length, 0);
  });

  it("does not execute a disabled AgentInstance", async () => {
    const { gate, probe } = await setup({
      instances: [instance({ status: "disabled" })],
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "INSTANCE_INACTIVE");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute a disabled or revoked AgentDefinition", async () => {
    for (const lifecycle of ["DISABLED", "REVOKED"] as const) {
      const { gate, probe } = await setup({
        definitions: [definition({ lifecycle })],
      });
      const result = await gate.execute(command());
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.reason, "DEFINITION_INACTIVE");
      }
      assert.equal(probe.invocationCount(), 0);
    }
  });

  it("does not execute against a stale definition version", async () => {
    const { gate, probe } = await setup({
      definitions: [definition({ version: "2" })],
      instances: [instance({ definitionVersion: "1" })],
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "DEFINITION_VERSION_MISMATCH");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute after a capability is removed from the allow-list", async () => {
    const { gate, probe } = await setup({
      definitions: [definition({ capabilityAllowList: [knownCapability] })],
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "CAPABILITY_NOT_ALLOWED");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("never executes governance.founder-decision", async () => {
    const { gate, probe } = await setup({
      definitions: [
        definition({
          capabilityAllowList: [founderCapability, EXECUTION_PROBE_CAPABILITY_ID],
          capabilityDenyList: [],
        }),
      ],
    });
    const result = await gate.execute(command({ capabilityId: founderCapability }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "AUTHORITY_DENIED");
      assert.equal(result.reason, "CAPABILITY_DENIED");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute when the Venture is inactive", async () => {
    const { gate, probe } = await setup({
      scope: presentScope("sunset"),
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "VENTURE_INACTIVE");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute a catalogue capability without an executor", async () => {
    const { gate, probe } = await setup({
      executors: [],
    });
    const result = await gate.execute(command({ capabilityId: knownCapability }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "NOT_EXECUTABLE");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute invalid arguments", async () => {
    const { gate, probe } = await setup();
    const result = await gate.execute(command({ arguments: { unexpected: true } }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_ARGUMENTS");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("rejects tenant identifiers injected through arguments", async () => {
    const { gate, probe } = await setup();
    const result = await gate.execute(
      command({ arguments: { workspaceId: otherWorkspaceId } }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_ARGUMENTS");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute a cross-workspace request", async () => {
    const { gate, probe } = await setup();
    const result = await gate.execute(
      command({
        workspaceId: otherWorkspaceId,
        actor: agentActor({ workspaceId: otherWorkspaceId }),
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "WORKSPACE_MISMATCH");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute a cross-Venture request", async () => {
    const { gate, probe } = await setup();
    const result = await gate.execute(
      command({
        ventureId: otherVentureId,
        actor: agentActor({ ventureId: otherVentureId }),
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "VENTURE_MISMATCH");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("returns the stored outcome for an identical duplicate without a second side effect", async () => {
    const url = await fileDatabase();
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const firstProbe = createExecutionProbeExecutor();
    const firstGate = createWorkforceExecutionGate({
      definitions: createWorkforceDefinitionRegistry([definition()]),
      instances: createWorkforceInstanceRegistry([instance()]),
      capabilities: testCapabilities(),
      scope: presentScope(),
      executors: createWorkforceExecutorRegistry([firstProbe.executor]),
      store: createWorkforceExecutionStore(),
    });
    const first = await firstGate.execute(command());
    assert.equal(first.ok, true);
    assert.equal(firstProbe.invocationCount(), 1);

    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const secondProbe = createExecutionProbeExecutor();
    const secondGate = createWorkforceExecutionGate({
      definitions: createWorkforceDefinitionRegistry([definition()]),
      instances: createWorkforceInstanceRegistry([instance()]),
      capabilities: testCapabilities(),
      scope: presentScope(),
      executors: createWorkforceExecutorRegistry([secondProbe.executor]),
      store: createWorkforceExecutionStore(),
    });
    const second = await secondGate.execute(command());
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.reused, true);
      assert.equal(second.executionId, first.ok ? first.executionId : undefined);
    }
    assert.equal(secondProbe.invocationCount(), 0);
  });

  it("re-evaluates authority before duplicate lookup so a disable is a kill switch", async () => {
    await resetPersistenceLifecycle(":memory:");
    const probe = createExecutionProbeExecutor();
    const store = createWorkforceExecutionStore();
    const active = createWorkforceExecutionGate({
      definitions: createWorkforceDefinitionRegistry([definition()]),
      instances: createWorkforceInstanceRegistry([instance()]),
      capabilities: testCapabilities(),
      scope: presentScope(),
      executors: createWorkforceExecutorRegistry([probe.executor]),
      store,
    });
    const first = await active.execute(command());
    assert.equal(first.ok, true);

    const disabled = createWorkforceExecutionGate({
      definitions: createWorkforceDefinitionRegistry([
        definition({ lifecycle: "DISABLED" }),
      ]),
      instances: createWorkforceInstanceRegistry([instance()]),
      capabilities: testCapabilities(),
      scope: presentScope(),
      executors: createWorkforceExecutorRegistry([probe.executor]),
      store,
    });
    const second = await disabled.execute(command());
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.failure, "AUTHORITY_DENIED");
      assert.equal(second.reason, "DEFINITION_INACTIVE");
    }
    assert.equal(probe.invocationCount(), 1);
  });

  it("does not invoke the executor twice for concurrent duplicates", async () => {
    await resetPersistenceLifecycle(":memory:");
    const delayed = createExecutionProbeExecutor();
    const wrapped: CapabilityExecutor = {
      ...delayed.executor,
      async execute(request) {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return delayed.executor.execute(request);
      },
    };
    const concurrent = createWorkforceExecutionGate({
      definitions: createWorkforceDefinitionRegistry([definition()]),
      instances: createWorkforceInstanceRegistry([instance()]),
      capabilities: testCapabilities(),
      scope: presentScope(),
      executors: createWorkforceExecutorRegistry([wrapped]),
      store: createWorkforceExecutionStore(),
    });
    const [a, b] = await Promise.all([
      concurrent.execute(command()),
      concurrent.execute(command()),
    ]);
    const successes = [a, b].filter((item) => item.ok);
    assert.ok(successes.length >= 1);
    assert.equal(delayed.invocationCount(), 1);
  });

  it("fails closed when the same key is reused with different arguments", async () => {
    const { gate, probe } = await setup();
    const first = await gate.execute(command({ arguments: { marker: "a" } }));
    assert.equal(first.ok, true);
    const second = await gate.execute(command({ arguments: { marker: "b" } }));
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.failure, "IDEMPOTENCY_MISMATCH");
    }
    assert.equal(probe.invocationCount(), 1);
  });

  it("hashes arguments independently of key insertion order", () => {
    assert.equal(
      hashExecutionArguments({ marker: "a", label: "b" }),
      hashExecutionArguments({ label: "b", marker: "a" }),
    );
  });

  it("does not automatically retry a failed executor", async () => {
    let invocations = 0;
    const failing: CapabilityExecutor = {
      id: EXECUTION_PROBE_CAPABILITY_ID,
      parseArguments: (value) =>
        createExecutionProbeExecutor().executor.parseArguments(value),
      async execute() {
        invocations += 1;
        throw new Error("boom");
      },
    };
    const { gate } = await setup({ executors: [failing] });
    const first = await gate.execute(command());
    const second = await gate.execute(command());
    assert.equal(first.ok, false);
    assert.equal(second.ok, false);
    if (!first.ok) {
      assert.equal(first.failure, "EXECUTION_FAILED");
    }
    if (!second.ok) {
      assert.equal(second.failure, "EXECUTION_FAILED");
    }
    assert.equal(invocations, 1);
  });

  it("maps a hung executor to a closed failure without retry", async () => {
    const hanging: CapabilityExecutor = {
      id: EXECUTION_PROBE_CAPABILITY_ID,
      parseArguments: (value) =>
        createExecutionProbeExecutor().executor.parseArguments(value),
      execute() {
        return new Promise(() => undefined);
      },
    };
    const { gate } = await setup({ executors: [hanging], timeoutMs: 30 });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "EXECUTION_FAILED");
    }
  });

  it("rejects a human actor without fabricating a UserId", async () => {
    const human: HumanWorkforceActor = {
      kind: "human",
      userId,
      workspaceId,
      ventureId,
    };
    const { gate, probe } = await setup();
    const result = await gate.execute(command({ actor: human }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "MALFORMED_REQUEST");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not treat ProposedAction text as an execution identity", () => {
    const left = command({ sourceRequestId: "req-1", sourceActionIndex: 0 });
    const right = command({ sourceRequestId: "req-1", sourceActionIndex: 1 });
    assert.notEqual(
      deriveExecutionIdempotencyKey(left),
      deriveExecutionIdempotencyKey(right),
    );
  });

  it("keeps the same gate for distinct Venture tenants without industry logic", async () => {
    await resetPersistenceLifecycle(":memory:");
    const retailId = "venture-retail" as VentureId;
    const professionalId = "venture-professional" as VentureId;
    const retailInstance: AgentInstance = {
      ...instance(),
      id: "instance-retail" as AgentInstanceId,
      ventureId: retailId,
    };
    const professionalInstance: AgentInstance = {
      ...instance(),
      id: "instance-professional" as AgentInstanceId,
      ventureId: professionalId,
    };
    const probe = createExecutionProbeExecutor();
    const gate = createWorkforceExecutionGate({
      definitions: createWorkforceDefinitionRegistry([definition()]),
      instances: createWorkforceInstanceRegistry([
        retailInstance,
        professionalInstance,
      ]),
      capabilities: testCapabilities(),
      scope: {
        async lookup() {
          return {
            ok: true,
            value: {
              workspaceFound: true,
              venture: { workspaceId, lifecycle: "operating" },
            },
          };
        },
      },
      executors: createWorkforceExecutorRegistry([probe.executor]),
      store: createWorkforceExecutionStore(),
    });

    const retail = await gate.execute(
      command({
        ventureId: retailId,
        agentInstanceId: retailInstance.id,
        actor: agentActor({
          ventureId: retailId,
          agentInstanceId: retailInstance.id,
        }),
        sourceRequestId: "req-retail",
      }),
    );
    const professional = await gate.execute(
      command({
        ventureId: professionalId,
        agentInstanceId: professionalInstance.id,
        actor: agentActor({
          ventureId: professionalId,
          agentInstanceId: professionalInstance.id,
        }),
        sourceRequestId: "req-professional",
      }),
    );
    assert.equal(retail.ok, true);
    assert.equal(professional.ok, true);
    assert.equal(probe.invocationCount(), 2);
  });

  it("does not put the probe in the production catalogue", () => {
    assert.equal(platformCapabilityRegistry.get(EXECUTION_PROBE_CAPABILITY_ID), undefined);
    assert.equal(
      platformCapabilityCatalog.some((item) => item.id === EXECUTION_PROBE_CAPABILITY_ID),
      false,
    );
  });

  it("does not import ModelPort, OpenAI, jobs, or generic executors", async () => {
    const source = await readFile(executionPath, "utf8");
    assert.doesNotMatch(source, /ModelPort/);
    assert.doesNotMatch(source, /openai/i);
    assert.doesNotMatch(source, /createFakeModelPort/);
    assert.doesNotMatch(source, /JobOrchestrator/);
    assert.doesNotMatch(source, /jobs\.enqueue/);
    assert.doesNotMatch(source, /spawn\(|exec\(|eval\(|PowerShell|readFile\(/);
    assert.doesNotMatch(source, /fetch\(/);
  });

  it("keeps execution files venture-agnostic", async () => {
    const files = [executionPath, executorsPath, storePath, typesPath];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      assert.doesNotMatch(
        source,
        /Qualora|Calviora|Farmora|patient|livestock|NHS|healthcare|currency|Kenya|Nigeria/i,
      );
    }
  });

  it("is not wired from ModelPort, the OpenAI adapter, or the kernel", async () => {
    const model = await readFile(modelPath, "utf8");
    const adapter = await readFile(adapterPath, "utf8");
    const kernel = await readFile(kernelPath, "utf8");
    assert.doesNotMatch(model, /createWorkforceExecutionGate|ExecutionPort/);
    assert.doesNotMatch(adapter, /createWorkforceExecutionGate|ExecutionPort/);
    assert.doesNotMatch(kernel, /createWorkforceExecutionGate|execution-probe/);
    assert.match(kernel, /jobs\.register\("noop"/);
    assert.match(kernel, /jobs\.register\(WORKFORCE_RUN_STEP_JOB/);
  });

  it("does not call evaluateAuthority with a caller EnforcementContext", async () => {
    const source = await readFile(executionPath, "utf8");
    assert.match(
      source,
      /evaluateAuthority\(\s*\{\s*actor: command\.actor,/,
    );
    assert.doesNotMatch(
      source,
      /evaluateAuthority\(\s*\{[^}]*contextVersion/,
    );
  });

  it("rejects secret-like argument keys", async () => {
    const { gate, probe } = await setup();
    for (const key of ["token", "apiKey", "password"]) {
      const result = await gate.execute(command({ arguments: { [key]: "x" } }));
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.failure, "INVALID_ARGUMENTS");
      }
      assert.equal(probe.invocationCount(), 0);
    }
    assert.equal(SECRET_ARGUMENT_KEYS.includes("token"), true);
  });

  it("supplies a Core-derived external idempotency key the caller cannot set", async () => {
    let seen: string | undefined;
    const probe = createExecutionProbeExecutor();
    const wrapped: CapabilityExecutor = {
      ...probe.executor,
      async execute(request) {
        seen = request.externalIdempotencyKey;
        return probe.executor.execute(request);
      },
    };
    const { gate } = await setup({ executors: [wrapped] });
    const request = command();
    const forged = {
      ...request,
      externalIdempotencyKey: "attacker-supplied",
    } as ExecutionRequest;
    const result = await gate.execute(forged);
    assert.equal(result.ok, true);
    assert.equal(seen, deriveExternalIdempotencyKey(request));
    assert.equal(seen, deriveExecutionIdempotencyKey(request));
    assert.notEqual(seen, "attacker-supplied");
  });

  it("stamps binding identity even when the executor omits a receipt", async () => {
    const probe = createExecutionProbeExecutor();
    const wrapped: CapabilityExecutor = {
      ...probe.executor,
      async execute(request) {
        const outcome = await probe.executor.execute(request);
        return { executorId: outcome.executorId, ok: true };
      },
    };
    const { gate } = await setup({
      executors: [wrapped],
      implementations: {
        get(id) {
          return id === EXECUTION_PROBE_CAPABILITY_ID
            ? {
                bindingId: "test.workforce.execution-probe",
                implementationVersion: "1.0.0",
              }
            : undefined;
        },
      },
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal("VERIFIED" in result, false);
      assert.equal(result.outcome.receipt?.implementationId, "test.workforce.execution-probe");
      assert.equal(result.outcome.receipt?.implementationVersion, "1.0.0");
    }
    const rows = await getDb().select().from(executionTable);
    assert.equal(rows[0]?.implementationId, "test.workforce.execution-probe");
    assert.equal(rows[0]?.implementationVersion, "1.0.0");
  });

  it("overwrites executor-supplied implementation identity from the binding", async () => {
    const probe = createExecutionProbeExecutor();
    const wrapped: CapabilityExecutor = {
      ...probe.executor,
      async execute(request) {
        const outcome = await probe.executor.execute(request);
        return {
          ...outcome,
          receipt: {
            implementationId: "executor-lie",
            implementationVersion: "999",
            externalReference: "ext-ok",
          },
        };
      },
    };
    const { gate } = await setup({
      executors: [wrapped],
      implementations: {
        get(id) {
          return id === EXECUTION_PROBE_CAPABILITY_ID
            ? {
                bindingId: "test.workforce.execution-probe",
                implementationVersion: "1.0.0",
              }
            : undefined;
        },
      },
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.outcome.receipt?.implementationId, "test.workforce.execution-probe");
      assert.equal(result.outcome.receipt?.implementationVersion, "1.0.0");
      assert.equal(result.outcome.receipt?.externalReference, "ext-ok");
    }
  });
});

describe("approval satisfaction is not an execution ticket", () => {
  it("executes current ALLOW_WITH_APPROVAL only for the bound approved fingerprint", async () => {
    const { gate, probe } = await setup({
      definitions: [definition({ autonomyCeiling: "prepare" })],
      approvals: {
        async satisfy(input) {
          return { approved: true, fingerprintHash: input.fingerprintHash };
        },
      },
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, true);
    assert.equal(probe.invocationCount(), 1);
  });

  it("does not let a prior approval override current DENY", async () => {
    const { gate, probe } = await setup({
      definitions: [definition({ autonomyCeiling: "prepare" })],
      instances: [instance({ status: "disabled" })],
      approvals: {
        async satisfy() {
          return { approved: true, fingerprintHash: "stale" };
        },
      },
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "AUTHORITY_DENIED");
      assert.equal(result.reason, "INSTANCE_INACTIVE");
    }
    assert.equal(probe.invocationCount(), 0);
  });

  it("does not execute when the approval fingerprint does not match", async () => {
    const { gate, probe } = await setup({
      definitions: [definition({ autonomyCeiling: "prepare" })],
      approvals: {
        async satisfy() {
          return { approved: true, fingerprintHash: "other" };
        },
      },
    });
    const result = await gate.execute(command());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "APPROVAL_REQUIRED");
    }
    assert.equal(probe.invocationCount(), 0);
  });
});

describe("execution contract tightening", () => {
  it("does not accept contextVersion or executorId as request fields", () => {
    const request: ExecutionRequest = command();
    assert.equal("contextVersion" in request, false);
    assert.equal("idempotencyKey" in request, false);
    assert.equal("executorId" in request, false);
    assert.equal("capabilityId" in request, true);
    assert.equal("sourceRequestId" in request, true);
  });

  it("still evaluates authority independently of the gate for the same identifiers", async () => {
    const authority = await evaluateAuthority(
      {
        actor: agentActor(),
        agentInstanceId,
        workspaceId,
        ventureId,
        capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
      },
      {
        definitions: createWorkforceDefinitionRegistry([definition()]),
        instances: createWorkforceInstanceRegistry([instance()]),
        capabilities: testCapabilities(),
        scope: presentScope(),
      },
    );
    assert.equal(authority.ok, true);
    if (authority.ok) {
      assert.equal(authority.decision.outcome, "ALLOW");
    }
  });
});
