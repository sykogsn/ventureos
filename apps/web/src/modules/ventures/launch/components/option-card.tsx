import { cn } from "@/utils/cn";

export function OptionCard({
  title,
  description,
  selected,
  onSelect,
  disabled,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "ids-transition flex flex-col gap-1 rounded-lg border p-3 text-left shadow-xs",
        selected
          ? "border-accent/40 bg-surface-muted"
          : "border-border bg-surface hover:bg-surface-muted",
        disabled && "cursor-not-allowed opacity-50 hover:bg-background",
      )}
    >
      <span className="ids-label">{title}</span>
      <span className="ids-caption">{description}</span>
    </button>
  );
}
