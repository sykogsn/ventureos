import { launchSteps } from "../types";
import {
  Sequence,
  SequenceCaption,
  SequenceMark,
  SequenceMarkBadge,
  SequenceRail,
  SequenceStep,
} from "@/core/layout";

export function WizardStepper({
  currentIndex,
  skippedIds,
}: {
  currentIndex: number;
  skippedIds: string[];
}) {
  return (
    <Sequence>
      {launchSteps.map((step, index) => {
        const complete = index < currentIndex && !skippedIds.includes(step.id);
        const current = index === currentIndex;
        const skipped = skippedIds.includes(step.id);
        const state = current
          ? "current"
          : complete
            ? "complete"
            : skipped
              ? "skipped"
              : "idle";

        return (
          <SequenceStep key={step.id}>
            <SequenceMark>
              <SequenceMarkBadge state={state}>{index + 1}</SequenceMarkBadge>
              <SequenceCaption current={current}>{step.label}</SequenceCaption>
            </SequenceMark>
            {index < launchSteps.length - 1 ? (
              <SequenceRail complete={index < currentIndex} />
            ) : null}
          </SequenceStep>
        );
      })}
    </Sequence>
  );
}
