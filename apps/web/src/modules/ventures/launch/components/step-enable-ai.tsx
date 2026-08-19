import { OptionCard } from "./option-card";

export function StepEnableAi({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <OptionCard
        title="Open the Executive Office"
        description="Seat operators, brief you daily, and run the operating cadence."
        selected={value === true}
        onSelect={() => onChange(true)}
      />
      <OptionCard
        title="Found without the Executive Office"
        description="Open a human-led Company HQ. You can seat the office later."
        selected={value === false}
        onSelect={() => onChange(false)}
      />
    </div>
  );
}
