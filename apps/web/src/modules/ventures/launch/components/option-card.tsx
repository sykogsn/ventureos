import { ChoiceFace } from "@/core/layout";

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
    <ChoiceFace selected={selected} disabled={disabled} onClick={onSelect}>
      <span className="ids-label">{title}</span>
      <span className="ids-caption">{description}</span>
    </ChoiceFace>
  );
}
