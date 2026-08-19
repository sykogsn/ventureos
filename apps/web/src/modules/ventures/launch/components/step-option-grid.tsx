import { OptionCard } from "./option-card";
import type { SelectOption } from "../types";

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
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <OptionCard
          key={option.id}
          title={option.label}
          description={option.description}
          selected={value === option.id}
          onSelect={() => onChange(option.id)}
        />
      ))}
    </div>
  );
}
