import { Field } from "@/core/layout";

export function StepName({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <Field>
      <span>Company name</span>
      <input
        className="vos-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit?.();
          }
        }}
        placeholder="e.g. Harbor Pay"
        autoFocus
        maxLength={80}
      />
    </Field>
  );
}
