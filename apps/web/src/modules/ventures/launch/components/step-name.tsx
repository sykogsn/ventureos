const inputClass = "vos-field h-11";

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
    <label className="flex flex-col gap-2">
      <span className="ids-label">Company name</span>
      <input
        className={inputClass}
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
    </label>
  );
}
