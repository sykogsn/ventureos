import { launchSteps } from "../types";
import { WizardNav } from "./wizard-nav";
import { WizardStepper } from "./wizard-stepper";
import type { ReactNode } from "react";
import { PageFrame } from "@/core";
import { WizardBody } from "@/core/layout";

export function WizardShell({
  currentIndex,
  skippedIds,
  error,
  launching,
  children,
  onBack,
  onNext,
}: {
  currentIndex: number;
  skippedIds: string[];
  error: string | null;
  launching: boolean;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
}) {
  const step = launchSteps[currentIndex];

  return (
    <PageFrame
      page="Found Company"
      kicker="Found a company"
      title={step?.title ?? "Found a company"}
      description={step?.description}
      summary={<WizardStepper currentIndex={currentIndex} skippedIds={skippedIds} />}
      footer={
        <WizardNav
          isFirst={currentIndex === 0}
          isLast={currentIndex === launchSteps.length - 1}
          launching={launching}
          onBack={onBack}
          onNext={onNext}
        />
      }
    >
      <WizardBody>{children}</WizardBody>
      {error ? <p className="ids-body text-danger">{error}</p> : null}
    </PageFrame>
  );
}
