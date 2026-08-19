import { launchSteps } from "../types";
import { WizardNav } from "./wizard-nav";
import { WizardStepper } from "./wizard-stepper";
import type { ReactNode } from "react";

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
    <section className="ids-surface-section vos-screen mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="ids-kicker">Found a company</p>
        <h1 className="ids-display">{step?.title}</h1>
        <p className="ids-body text-muted">{step?.description}</p>
      </header>

      <WizardStepper currentIndex={currentIndex} skippedIds={skippedIds} />

      <div className="flex min-h-[280px] flex-col gap-4">{children}</div>

      {error ? <p className="ids-body text-danger">{error}</p> : null}

      <WizardNav
        isFirst={currentIndex === 0}
        isLast={currentIndex === launchSteps.length - 1}
        launching={launching}
        onBack={onBack}
        onNext={onNext}
      />
    </section>
  );
}
