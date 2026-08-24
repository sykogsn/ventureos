export const WORKSHOP_TO_IDS = {
  "surface-primary": "--background / --workspace",
  "surface-secondary": "--sidebar / --ids-foundation-surface-fill",
  "surface-elevated": "--surface-elevated / ids-surface-elevated",
  "surface-sunken": "--surface / ids-surface",
  "text-primary": "--text-primary",
  "text-secondary": "--text-secondary",
  "text-muted": "--text-muted",
  "border-subtle": "--border",
  accent: "--accent via IdsBrandBinder",
  "status-critical": "--danger / ids-status-risk",
  "status-high": "--warning / ids-status-watch",
  "status-medium": "--info / ids-status-info",
  "status-positive": "--success / ids-status-healthy",
  "status-neutral": "--text-muted / ids-status-quiet",
  "data-venture": "data-ids-brand + data-ids-atmosphere",
} as const;

export type WorkshopStatusLevel =
  | "critical"
  | "high"
  | "medium"
  | "positive"
  | "neutral";

export const STATUS_PRESENTATION: Record<
  WorkshopStatusLevel,
  { label: string; glyph: string; tone: string }
> = {
  critical: { label: "Critical", glyph: "▲", tone: "ids-status-risk" },
  high: { label: "High", glyph: "◆", tone: "ids-status-watch" },
  medium: { label: "Medium", glyph: "■", tone: "ids-status-info" },
  positive: { label: "Positive", glyph: "●", tone: "ids-status-healthy" },
  neutral: { label: "Neutral", glyph: "–", tone: "ids-status-quiet" },
};
