import { cn } from "@/utils/cn";
import { launchSteps } from "../types";

export function WizardStepper({
  currentIndex,
  skippedIds,
}: {
  currentIndex: number;
  skippedIds: string[];
}) {
  return (
    <ol className="flex items-start gap-1 overflow-x-auto pb-1">
      {launchSteps.map((step, index) => {
        const complete = index < currentIndex && !skippedIds.includes(step.id);
        const current = index === currentIndex;
        const skipped = skippedIds.includes(step.id);

        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
            <div className="flex min-w-0 flex-col items-center gap-2">
              <span
                className={cn(
                  "ids-kicker ids-transition flex h-7 w-7 items-center justify-center rounded-full",
                  current && "bg-accent text-accent-foreground",
                  complete && "bg-accent/20 text-foreground",
                  skipped && "bg-surface-muted text-muted line-through",
                  !current && !complete && !skipped && "bg-surface-muted text-muted",
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  "ids-caption hidden truncate sm:block",
                  current ? "ids-label text-foreground" : "text-muted",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < launchSteps.length - 1 ? (
              <span
                className={cn(
                  "mb-5 hidden h-px flex-1 sm:block",
                  index < currentIndex ? "bg-foreground/40" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
