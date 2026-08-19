import { Button } from "@repo/ui/button";
import { cn } from "@/utils/cn";

export function WizardNav({
  isFirst,
  isLast,
  launching,
  onBack,
  onNext,
}: {
  isFirst: boolean;
  isLast: boolean;
  launching: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button
        variant="secondary"
        className={cn(isFirst && "invisible")}
        onClick={onBack}
        disabled={isFirst || launching}
      >
        Previous
      </Button>
      <Button onClick={onNext} disabled={launching}>
        {isLast ? (launching ? "Founding…" : "Found Company") : "Next"}
      </Button>
    </div>
  );
}
