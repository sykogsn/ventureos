import { OptionCard } from "./option-card";
import { executiveOptions } from "../options";
import type { AiExecutiveId } from "../types";
import { Grid } from "@/core/layout";

export function StepExecutiveTeam({
  enabled,
  selected,
  onToggle,
}: {
  enabled: boolean;
  selected: AiExecutiveId[];
  onToggle: (id: AiExecutiveId) => void;
}) {
  if (!enabled) {
    return (
      <p className="ids-body text-muted">
        The Executive Office is closed for this founding. Seats stay empty until
        you open it.
      </p>
    );
  }

  return (
    <Grid variant="pair">
      {executiveOptions.map((option) => (
        <OptionCard
          key={option.id}
          title={option.label}
          description={option.description}
          selected={selected.includes(option.id)}
          onSelect={() => onToggle(option.id)}
        />
      ))}
    </Grid>
  );
}
