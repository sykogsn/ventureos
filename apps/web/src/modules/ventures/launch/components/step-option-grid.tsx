import { OptionCard } from "./option-card";
import type { SelectOption } from "../types";
import { Grid } from "@/core/layout";

export function StepOptionGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <Grid variant="pair">
      {options.map((option) => (
        <OptionCard
          key={option.id}
          title={option.label}
          description={option.description}
          selected={value === option.id}
          onSelect={() => onChange(option.id)}
        />
      ))}
    </Grid>
  );
}
