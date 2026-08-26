import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AgentInstanceId, VentureId, WorkspaceId } from "@/contracts/ids";
import type { ModelReasoningResult, ModelRequest } from "@/core/workforce/types";
import {
  createOpenAIModelPort,
  DEFAULT_OPENAI_MODEL,
  OPENAI_RESPONSES_URL,
} from "./openai-adapter";

const workspaceId = "ws-1" as WorkspaceId;
const ventureId = "venture-1" as VentureId;
const agentInstanceId = "instance-1" as AgentInstanceId;
const allowedCapability = "intelligence.knowledge-graph";
const adapterPath = fileURLToPath(import.meta.url);
const webSrc = join(dirname(adapterPath), "../..");

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    requestId: "req-1",
    workspaceId,
    ventureId,
    agentInstanceId,
    purpose: "workforce.reason",
    platformInstructions: "Follow VentureOS platform rules.",
    roleInstructions: "Research Analyst.",
    task: "Summarise the supplied note.",
    context: { objective: "Identify one gap.", citations: [] },
    evidence: [{ id: "ev-1", sourceType: "note", excerpt: "Coverage is incomplete." }],
    candidateCapabilities: [
      { id: allowedCapability, description: "Knowledge graph facts." },
    ],
    ...overrides,
  };
}

function validOutput(): ModelReasoningResult {
  return {
    summary: "Coverage is incomplete.",
    explanation: "The supplied note states a gap.",
    findings: [{ statement: "Coverage gap.", evidenceIds: ["ev-1"] }],
    uncertainties: ["Sample size is unknown."],
    proposedActions: [
      {
        capabilityId: allowedCapability,
        intent: "Retrieve related knowledge.",
        arguments: { query: "coverage" },
        rationale: "Ground the gap.",
        evidenceIds: ["ev-1"],
      },
    ],
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completedBody(output: unknown) {
  return {
    id: "resp_123",
    output_text: JSON.stringify(output),
    usage: { input_tokens: 11, output_tokens: 22 },
  };
}

describe("OpenAI Responses adapter", () => {
  it("fails MISSING_CREDENTIALS without an API key and does not fetch", async () => {
    let calls = 0;
    const port = createOpenAIModelPort({
      env: {},
      fetch: async () => {
        calls += 1;
        return jsonResponse(200, completedBody(validOutput()));
      },
    });
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "MISSING_CREDENTIALS");
    }
    assert.equal(calls, 0);
  });

  it("maps timeout to TIMEOUT without retry", async () => {
    let calls = 0;
    const port = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () => {
        calls += 1;
        const error = new Error("aborted");
        error.name = "TimeoutError";
        throw error;
      },
    });
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "TIMEOUT");
    }
    assert.equal(calls, 1);
  });

  it("maps 429 to RATE_LIMITED and retries once", async () => {
    let calls = 0;
    const port = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () => {
        calls += 1;
        return jsonResponse(429, { error: { message: "slow down" } });
      },
    });
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "RATE_LIMITED");
    }
    assert.equal(calls, 2);
  });

  it("maps 5xx and network errors to UNAVAILABLE with at most two attempts", async () => {
    let serverCalls = 0;
    const server = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () => {
        serverCalls += 1;
        return jsonResponse(503, { error: { message: "down" } });
      },
    });
    const serverResult = await server.invoke(request());
    assert.equal(serverResult.ok, false);
    if (!serverResult.ok) {
      assert.equal(serverResult.failure, "UNAVAILABLE");
    }
    assert.equal(serverCalls, 2);

    let networkCalls = 0;
    const network = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () => {
        networkCalls += 1;
        throw new Error("offline");
      },
    });
    const networkResult = await network.invoke(request());
    assert.equal(networkResult.ok, false);
    if (!networkResult.ok) {
      assert.equal(networkResult.failure, "UNAVAILABLE");
    }
    assert.equal(networkCalls, 2);
  });

  it("maps HTTP 401 to UNAVAILABLE", async () => {
    const port = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () => jsonResponse(401, { error: { message: "invalid" } }),
    });
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "UNAVAILABLE");
    }
  });

  it("maps invalid JSON and empty output to INVALID_OUTPUT without retry", async () => {
    let invalidCalls = 0;
    const invalid = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () => {
        invalidCalls += 1;
        return jsonResponse(200, { id: "resp_1", output_text: "{not-json" });
      },
    });
    const invalidResult = await invalid.invoke(request());
    assert.equal(invalidResult.ok, false);
    if (!invalidResult.ok) {
      assert.equal(invalidResult.failure, "INVALID_OUTPUT");
    }
    assert.equal(invalidCalls, 1);

    let emptyCalls = 0;
    const empty = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () => {
        emptyCalls += 1;
        return jsonResponse(200, { id: "resp_1", output_text: "" });
      },
    });
    const emptyResult = await empty.invoke(request());
    assert.equal(emptyResult.ok, false);
    if (!emptyResult.ok) {
      assert.equal(emptyResult.failure, "INVALID_OUTPUT");
    }
    assert.equal(emptyCalls, 1);
  });

  it("maps provider refusal to CONTENT_REFUSED", async () => {
    const port = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () =>
        jsonResponse(200, {
          id: "resp_1",
          output: [
            {
              type: "message",
              content: [{ type: "refusal", refusal: "policy" }],
            },
          ],
        }),
    });
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "CONTENT_REFUSED");
    }
  });

  it("posts to the Responses API without tools and returns trace on success", async () => {
    let url = "";
    let posted: Record<string, unknown> | undefined;
    const port = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test", VOS_OPENAI_MODEL: "gpt-4o-mini" },
      now: () => 1_000,
      fetch: async (input, init) => {
        url = String(input);
        posted = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse(200, completedBody(validOutput()));
      },
    });
    const result = await port.invoke(request());
    assert.equal(url, OPENAI_RESPONSES_URL);
    assert.equal(posted?.model, DEFAULT_OPENAI_MODEL);
    assert.equal("tools" in (posted ?? {}), false);
    assert.equal("functions" in (posted ?? {}), false);
    const text = posted?.text as { format?: { type?: string; strict?: boolean } };
    assert.equal(text?.format?.type, "json_schema");
    assert.equal(text?.format?.strict, true);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.trace.provider, "openai");
      assert.equal(result.trace.model, "gpt-4o-mini");
      assert.equal(result.trace.providerRequestId, "resp_123");
      assert.equal(result.trace.inputTokens, 11);
      assert.equal(result.trace.outputTokens, 22);
    }
  });

  it("rejects oversized requests before HTTP", async () => {
    let calls = 0;
    const port = createOpenAIModelPort({
      env: { VOS_OPENAI_API_KEY: "sk-test" },
      fetch: async () => {
        calls += 1;
        return jsonResponse(200, completedBody(validOutput()));
      },
    });
    const result = await port.invoke(request({ task: "x".repeat(33_000) }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_OUTPUT");
    }
    assert.equal(calls, 0);
  });

  it("is not imported by client UI and does not call ExecutionPort", async () => {
    const source = await readFile(join(dirname(adapterPath), "openai-adapter.ts"), "utf8");
    assert.doesNotMatch(source, /ExecutionPort/);
    assert.doesNotMatch(source, /\.execute\(/);
    assert.doesNotMatch(source, /chat\/completions/);
    assert.match(source, /\/v1\/responses/);

    const uiFiles = [
      ...(await listFiles(join(webSrc, "app"), ".tsx")),
      ...(await listFiles(join(webSrc, "modules"), ".tsx")),
      ...(await listFiles(join(webSrc, "core/shell"), ".tsx")),
    ];
    for (const file of uiFiles) {
      const contents = await readFile(file, "utf8");
      assert.doesNotMatch(
        contents,
        /platform\/ai\/openai-adapter/,
        file,
      );
    }
  });

  it("leaves EIR, VIC, authority, jobs, audit, persistence, and kernel untouched", async () => {
    const kernel = await readFile(join(webSrc, "platform/kernel.ts"), "utf8");
    assert.doesNotMatch(kernel, /workforce\.run/);
    assert.doesNotMatch(kernel, /createOpenAIModelPort/);

    const authority = await readFile(join(webSrc, "core/workforce/authority.ts"), "utf8");
    assert.doesNotMatch(authority, /openai/i);
    assert.doesNotMatch(authority, /ModelPort/);

    const adapter = await readFile(join(dirname(adapterPath), "openai-adapter.ts"), "utf8");
    assert.doesNotMatch(adapter, /Qualora Evidence Analyst/);
  });
});

async function listFiles(root: string, suffix: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path, suffix)));
    } else if (entry.name.endsWith(suffix)) {
      files.push(path);
    }
  }
  return files;
}
