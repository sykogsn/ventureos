import { Cluster } from "@/core/layout";
import {
  STATUS_PRESENTATION,
  type WorkshopStatusLevel,
} from "./mapping";

export function StatusIndicator({
  level,
  label,
}: {
  level: WorkshopStatusLevel;
  label?: string;
}) {
  const presentation = STATUS_PRESENTATION[level];
  const text = label ?? presentation.label;

  return (
    <Cluster justify="start">
      <span className="ids-caption" aria-hidden="true">
        {presentation.glyph}
      </span>
      <span className={`ids-chip ${presentation.tone}`}>{text}</span>
    </Cluster>
  );
}
