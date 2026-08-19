import {
  categoryOptions,
  goalOptions,
  labelFor,
  stageOptions,
} from "./options";
import type { LaunchDraft } from "./types";
import { createVentureGenome } from "@/core/venture-genome";
import type { VentureGenome } from "@/core/venture-genome";

export function inferVentureGenome(draft: LaunchDraft): VentureGenome {
  const name = draft.name.trim() || "Untitled";
  const category = labelFor(categoryOptions, draft.categoryId);
  const stage = labelFor(stageOptions, draft.stageId);
  const goal = labelFor(goalOptions, draft.goalId);
  const posture = draft.aiEnabled ? "ai-native" : "human-led";

  const risk =
    draft.stageId === "idea" || draft.stageId === "pre-seed"
      ? "exploratory"
      : draft.stageId === "growth"
        ? "scaling"
        : "focused";

  const motionByGoal: Record<string, string> = {
    mvp: "Ship a narrow wedge, then instrument learning.",
    customers: "Prove a paid motion before expanding surface area.",
    raise: "Tighten the narrative and run a short, owned process.",
    hire: "Install owners before adding more work.",
    ops: "Cadence first: one source of truth, one weekly review.",
  };

  const cadence =
    posture === "ai-native"
      ? "Daily Executive Office briefing, weekly founder review."
      : "Weekly founder review until the Executive Office is seated.";

  return createVentureGenome({
    category,
    stage,
    goal,
    posture,
    risk,
    motion:
      motionByGoal[draft.goalId ?? "ops"] ??
      "Cadence first: one source of truth, one weekly review.",
    thesis: `${name} is a ${category.toLowerCase()} company at ${stage.toLowerCase()}, pointed at ${goal.toLowerCase()}.`,
    cadence,
  });
}
