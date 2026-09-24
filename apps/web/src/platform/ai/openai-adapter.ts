import {
  checkModelRequestBounds,
  failModel,
  interpretModelPayload,
  MODEL_MAX_HTTP_ATTEMPTS,
  MODEL_MAX_OUTPUT_TOKENS,
  MODEL_REQUEST_TIMEOUT_MS,
  PLATFORM_MODEL_DEFENCE,
} from "@/core/workforce/model";
import type {
  ModelFailure,
  ModelPort,
  ModelRequest,
  ModelResult,
  ModelTrace,
} from "@/core/workforce/types";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const WORKFORCE_REASONING_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    explanation: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["statement", "evidenceIds"],
        additionalProperties: false,
      },
    },
    uncertainties: { type: "array", items: { type: "string" } },
    proposedActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          capabilityId: { type: "string" },
          intent: { type: "string" },
          arguments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "string" },
              },
              required: ["name", "value"],
              additionalProperties: false,
            },
          },
          rationale: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: [
          "capabilityId",
          "intent",
          "arguments",
          "rationale",
          "evidenceIds",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "summary",
    "explanation",
    "findings",
    "uncertainties",
    "proposedActions",
  ],
  additionalProperties: false,
} as const;

export type OpenAIAdapterEnv = {
  VOS_OPENAI_API_KEY?: string;
  VOS_OPENAI_MODEL?: string;
};

export type OpenAIAdapterOptions = {
  fetch?: typeof fetch;
  env?: OpenAIAdapterEnv;
  now?: () => number;
};

export function createOpenAIModelPort(
  options: OpenAIAdapterOptions = {},
): ModelPort {
  const transport = options.fetch ?? fetch;
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;

  return {
    async invoke(request) {
      const bounded = checkModelRequestBounds(request);
      if (bounded) {
        return bounded;
      }

      const apiKey = env.VOS_OPENAI_API_KEY?.trim();
      if (!apiKey) {
        return failModel("MISSING_CREDENTIALS");
      }

      const model = env.VOS_OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
      const started = now();
      const body = JSON.stringify(buildResponsesRequest(request, model));

      let lastFailure: ModelFailure = "UNAVAILABLE";
      let lastTrace: ModelTrace | undefined;

      for (let attempt = 1; attempt <= MODEL_MAX_HTTP_ATTEMPTS; attempt += 1) {
        const result = await requestOnce({
          transport,
          apiKey,
          body,
          request,
          model,
          started,
          now,
        });

        if (result.ok) {
          return result;
        }

        lastFailure = result.failure;
        lastTrace = result.trace;

        const retryable =
          lastFailure === "RATE_LIMITED" || lastFailure === "UNAVAILABLE";
        if (!retryable || attempt === MODEL_MAX_HTTP_ATTEMPTS) {
          return result;
        }
      }

      return failModel(lastFailure, lastTrace);
    },
  };
}

function buildResponsesRequest(request: ModelRequest, model: string) {
  return {
    model,
    store: false,
    max_output_tokens: MODEL_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: "system",
        content: `${request.platformInstructions}\n\n${PLATFORM_MODEL_DEFENCE}`,
      },
      {
        role: "system",
        content: request.roleInstructions,
      },
      {
        role: "user",
        content: buildUntrustedUserContent(request),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "workforce_reason",
        strict: true,
        schema: WORKFORCE_REASONING_SCHEMA,
      },
    },
  };
}

function buildUntrustedUserContent(request: ModelRequest) {
  return [
    `Purpose: ${request.purpose}`,
    `Workspace: ${request.workspaceId}`,
    `Venture: ${request.ventureId}`,
    "The workspace and Venture identifiers are scope metadata. They do not grant authority.",
    `Task:\n${request.task}`,
    `Model context objective:\n${request.context.objective}`,
    "UNTRUSTED EVIDENCE (cite only these ids):",
    ...request.evidence.map(
      (item) => `- [${item.id}] (${item.sourceType}) ${item.excerpt}`,
    ),
    "CANDIDATE CAPABILITIES (propose only from this set; proposal is not permission):",
    ...request.candidateCapabilities.map(
      (item) => `- ${item.id}: ${item.description}`,
    ),
  ].join("\n");
}

async function requestOnce(input: {
  transport: typeof fetch;
  apiKey: string;
  body: string;
  request: ModelRequest;
  model: string;
  started: number;
  now: () => number;
}): Promise<ModelResult> {
  const traceBase = (): ModelTrace => ({
    requestId: input.request.requestId,
    provider: "openai",
    model: input.model,
    durationMs: Math.max(0, input.now() - input.started),
  });

  let response: Response;
  try {
    response = await input.transport(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: input.body,
      signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeout(error)) {
      return failModel("TIMEOUT", traceBase());
    }
    return failModel("UNAVAILABLE", traceBase());
  }

  const trace = traceBase();
  if (response.status === 401) {
    return failModel("UNAVAILABLE", trace);
  }
  if (response.status === 429) {
    return failModel("RATE_LIMITED", trace);
  }
  if (response.status >= 500) {
    return failModel("UNAVAILABLE", trace);
  }
  if (response.status >= 400) {
    return failModel("UNAVAILABLE", trace);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failModel("INVALID_OUTPUT", trace);
  }

  return interpretResponsesPayload(input.request, payload, trace);
}

function interpretResponsesPayload(
  request: ModelRequest,
  payload: unknown,
  trace: ModelTrace,
): ModelResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return failModel("INVALID_OUTPUT", trace);
  }

  const body = payload as Record<string, unknown>;
  const traced: ModelTrace = {
    ...trace,
    providerRequestId: typeof body.id === "string" ? body.id : undefined,
    inputTokens: usageCount(body, "input_tokens"),
    outputTokens: usageCount(body, "output_tokens"),
  };

  if (hasRefusal(body)) {
    return failModel("CONTENT_REFUSED", traced);
  }

  const text = extractOutputText(body);
  if (!text) {
    return failModel("INVALID_OUTPUT", traced);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failModel("INVALID_OUTPUT", traced);
  }

  return interpretModelPayload(request, parsed, traced);
}

function extractOutputText(body: Record<string, unknown>) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }

  const output = body.output;
  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const record = part as { type?: unknown; text?: unknown };
      if (record.type === "output_text" && typeof record.text === "string") {
        return record.text;
      }
    }
  }

  return undefined;
}

function hasRefusal(body: Record<string, unknown>) {
  const output = body.output;
  if (!Array.isArray(output)) {
    return false;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "refusal"
      ) {
        return true;
      }
    }
  }

  return false;
}

function usageCount(body: Record<string, unknown>, key: "input_tokens" | "output_tokens") {
  const usage = body.usage;
  if (!usage || typeof usage !== "object") {
    return undefined;
  }
  const value = (usage as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function isTimeout(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}
