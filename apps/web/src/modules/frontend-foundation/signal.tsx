import { Cluster, Stack } from "@/core/layout";

export type ConfidenceLevel = "high" | "moderate" | "low";
export type TrendDirection = "up" | "down" | "flat";

const confidenceCopy: Record<ConfidenceLevel, { label: string; marks: string }> =
  {
    high: { label: "High confidence", marks: "●●●" },
    moderate: { label: "Moderate confidence", marks: "●●○" },
    low: { label: "Low confidence", marks: "●○○" },
  };

export function ConfidenceMeter({ level }: { level: ConfidenceLevel }) {
  const presentation = confidenceCopy[level];

  return (
    <Cluster justify="start">
      <span className="ids-caption" aria-hidden="true">
        {presentation.marks}
      </span>
      <span className="ids-caption">{presentation.label}</span>
    </Cluster>
  );
}

export function Trend({
  direction,
  label,
}: {
  direction: TrendDirection;
  label?: string;
}) {
  const glyph = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const word =
    direction === "up" ? "Rising" : direction === "down" ? "Falling" : "Unchanged";

  return (
    <Cluster justify="start">
      <span className="ids-caption" aria-hidden="true">
        {glyph}
      </span>
      <span className="ids-caption">{label ?? word}</span>
    </Cluster>
  );
}

export function PresentationMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <Stack gap="tight">
      <p className="ids-kicker">{label}</p>
      <p className="ids-metric">{value}</p>
      {note ? <p className="ids-caption">{note}</p> : null}
    </Stack>
  );
}
