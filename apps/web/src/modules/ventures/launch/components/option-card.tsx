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
        "ids-surface-card ids-transition flex flex-col gap-1 p-3 text-left",
        selected ? "ids-surface-selected" : "hover:bg-surface-hover",
        disabled && "cursor-not-allowed opacity-50 hover:bg-background",
      )}
    >
      <span className="ids-label">{title}</span>
      <span className="ids-caption">{description}</span>
    </button>
  );
}
