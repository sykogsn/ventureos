import { z } from "zod";
import { FOUNDER_ONLY_CAPABILITIES } from "./authority";
import type {
  CapabilityExecutor,
  ExecutionArguments,
  ExecutionOutcome,
  ExecutorInvocation,
} from "./types";

export const EXECUTION_PROBE_CAPABILITY_ID = "workforce.execution-probe";

const probeArgumentSchema = z
  .object({
    marker: z.string().max(64).optional(),
    label: z.string().max(64).optional(),
  })
  .strict();

export type WorkforceExecutorRegistry = {
  get(id: string): CapabilityExecutor | undefined;
};

export function createWorkforceExecutorRegistry(
  executors: CapabilityExecutor[],
): WorkforceExecutorRegistry {
  const byId = new Map<string, CapabilityExecutor>();

  for (const executor of executors) {
    if ((FOUNDER_ONLY_CAPABILITIES as readonly string[]).includes(executor.id)) {
      throw new Error(`Executor registration forbidden: ${executor.id}.`);
    }
    if (byId.has(executor.id)) {
      throw new Error(`Duplicate executor: ${executor.id}.`);
    }
    byId.set(executor.id, executor);
  }

  return {
    get(id) {
      return byId.get(id);
    },
  };
}

export type ExecutionProbe = {
  executor: CapabilityExecutor;
  invocationCount(): number;
};

/**
 * Test-only set-once probe. Not a production capability and not in the
 * production Capability Registry.
 */
export function createExecutionProbeExecutor(): ExecutionProbe {
  let count = 0;
  const invoked = new Set<string>();

  const executor: CapabilityExecutor = {
    id: EXECUTION_PROBE_CAPABILITY_ID,
    parseArguments(value) {
      const parsed = probeArgumentSchema.safeParse(value);
      if (!parsed.success) {
        return { ok: false };
      }
      return { ok: true, value: asArguments(parsed.data) };
    },
    async execute(request: ExecutorInvocation): Promise<ExecutionOutcome> {
      if (invoked.has(request.executionId)) {
        return {
          executorId: EXECUTION_PROBE_CAPABILITY_ID,
          ok: true,
          output: { invoked: count },
        };
      }
      invoked.add(request.executionId);
      count += 1;
      return {
        executorId: EXECUTION_PROBE_CAPABILITY_ID,
        ok: true,
        output: { invoked: count },
      };
    },
  };

  return {
    executor,
    invocationCount() {
      return count;
    },
  };
}

function asArguments(value: object): ExecutionArguments {
  const args: ExecutionArguments = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" || entry === null) {
      args[key] = entry;
    }
  }
  return args;
}
