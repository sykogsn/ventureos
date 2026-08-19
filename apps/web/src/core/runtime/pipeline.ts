import { assertRuntimeCapabilities } from "../capability/registry";
import { platformCapabilityRegistry } from "../capability/catalog";
import { assertRuntimeInstanceUsage } from "../venture-definition/enforcement";
import { hydratePolicyEngine } from "../policy/evaluation";
import { hydrateRecommendations } from "../recommendation/model";
import type { VentureIntelligenceCore } from "../venture/types";
import {
  applyRuntimeEvent,
  refreshKnowledgeGraph,
  refreshOperatingHealth,
} from "./effects";
import { createIntelligenceRefresh } from "./events";
import type { IntelligenceSnapshot, RuntimeEvent } from "./types";

/** Sole intelligence orchestration entry. Stages: `RUNTIME_PIPELINE` in `contract.ts`. */
export function runExecutiveIntelligenceRuntime(
  core: VentureIntelligenceCore,
  event: RuntimeEvent = createIntelligenceRefresh("1970-01-01T00:00:00.000Z"),
): IntelligenceSnapshot {
  assertRuntimeCapabilities(platformCapabilityRegistry);
  assertRuntimeInstanceUsage(core, event);
  const withEvent = applyRuntimeEvent(core, event);
  const withPolicy = hydratePolicyEngine(withEvent);
  const withRecommendations = hydrateRecommendations(withPolicy);
  const withHealth = refreshOperatingHealth(withRecommendations);
  const withKnowledge = refreshKnowledgeGraph(withHealth);

  return {
    core: withKnowledge,
    event,
    findings: withKnowledge.policy.findings,
    occurredAt: event.occurredAt,
  };
}
