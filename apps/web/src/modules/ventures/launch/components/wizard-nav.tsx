import { Button } from "@repo/ui/button";
import { Cluster } from "@/core/layout";

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
    <Cluster justify="between">
      <Button
        variant="secondary"
        className={isFirst ? "invisible" : undefined}
        onClick={onBack}
        disabled={isFirst || launching}
      >
        Previous
      </Button>
      <Button onClick={onNext} disabled={launching}>
        {isLast ? (launching ? "Founding…" : "Found Company") : "Next"}
      </Button>
    </Cluster>
  );
}
