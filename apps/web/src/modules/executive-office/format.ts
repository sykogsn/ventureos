import type { ExecutiveId, ExecutiveProfile } from "./types";

export function formatBriefingDate(date: Date, locale = "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function resolveActionHref(executive: ExecutiveProfile, basePath: string) {
  if (executive.primaryAction.href === "/dashboard") {
    return "/dashboard";
  }

  return officePath(basePath, executive.id);
}

export { confidenceLabel as confidenceBand } from "@/core/recommendation/confidence";

export function officePath(basePath: string, id: ExecutiveId) {
  return `${basePath}/${id}`;
}

export function findExecutive(executives: ExecutiveProfile[], id: string) {
  return executives.find((executive) => executive.id === id);
}
