import type { LaunchDraft, LaunchStepId } from "./types";
import { launchProductHasFeature } from "./products";

function officeAvailable(draft: LaunchDraft) {
  return draft.productId
    ? launchProductHasFeature(draft.productId, "executive-office")
    : true;
}

export function validateLaunchStep(
  stepId: LaunchStepId,
  draft: LaunchDraft,
): string | null {
  switch (stepId) {
    case "product":
      return draft.productId ? null : "Select a product to continue.";
    case "name": {
      const name = draft.name.trim();
      if (name.length < 2) {
        return "Give the company a name of at least 2 characters.";
      }
      if (name.length > 80) {
        return "Keep the name under 80 characters.";
      }
      return null;
    }
    case "category":
      return draft.categoryId ? null : "Select a category to continue.";
    case "stage":
      return draft.stageId ? null : "Select the current stage.";
    case "goal":
      return draft.goalId ? null : "Choose one primary goal.";
    case "ai":
      if (!officeAvailable(draft)) {
        return null;
      }
      return draft.aiEnabled === null
        ? "Choose whether VentureOS AI should run this company."
        : null;
    case "team":
      if (!draft.aiEnabled || !officeAvailable(draft)) {
        return null;
      }
      return draft.executiveIds.length > 0
        ? null
        : "Seat at least one operator in the Executive Office, or go back and close it.";
    case "mission":
      return (
        validateLaunchStep("product", draft) ??
        validateLaunchStep("name", draft) ??
        validateLaunchStep("category", draft) ??
        validateLaunchStep("stage", draft) ??
        validateLaunchStep("goal", draft) ??
        validateLaunchStep("ai", draft) ??
        validateLaunchStep("team", draft)
      );
    default:
      return null;
  }
}

export function slugFromName(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "venture";
}
