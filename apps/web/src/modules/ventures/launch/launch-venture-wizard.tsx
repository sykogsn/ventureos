"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "./components/wizard-shell";
import { StepName } from "./components/step-name";
import { StepOptionGrid } from "./components/step-option-grid";
import { StepEnableAi } from "./components/step-enable-ai";
import { StepExecutiveTeam } from "./components/step-executive-team";
import { StepMissionControl } from "./components/step-mission-control";
import { LaunchSequence } from "./components/launch-sequence";
import { categoryOptions, goalOptions, stageOptions } from "./options";
import { foundCompanyAction } from "@/modules/intelligence/actions";
import {
  emptyLaunchDraft,
  launchArtefactCatalog,
  launchSteps,
  type AiExecutiveId,
  type LaunchDraft,
} from "./types";
import { companyHomeHref } from "@/modules/ventures/home";
import { launchProductHasFeature, listLaunchProducts } from "./products";
import { validateLaunchStep } from "./validation";

function skipsOffice(draft: LaunchDraft) {
  return draft.productId
    ? !launchProductHasFeature(draft.productId, "executive-office")
    : false;
}

export function LaunchVentureWizard() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<LaunchDraft>(emptyLaunchDraft);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const products = useMemo(() => listLaunchProducts(), []);

  const step = launchSteps[index];
  const officeOff = skipsOffice(draft);
  const skippedIds = useMemo(() => {
    const ids: string[] = [];
    if (officeOff) {
      ids.push("ai", "team");
    } else if (draft.aiEnabled === false) {
      ids.push("team");
    }
    return ids;
  }, [draft.aiEnabled, officeOff]);

  useEffect(() => {
    if (!launching || !slug) {
      return;
    }

    if (sequenceIndex >= launchArtefactCatalog.length) {
      setSequenceDone(true);
      const timer = window.setTimeout(() => {
        router.push(companyHomeHref(slug));
      }, 500);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setSequenceIndex((current) => current + 1);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [launching, sequenceIndex, slug, router]);

  function patch(next: Partial<LaunchDraft>) {
    setDraft((current) => ({ ...current, ...next }));
    setError(null);
  }

  function toggleExecutive(id: AiExecutiveId) {
    setDraft((current) => {
      const exists = current.executiveIds.includes(id);
      return {
        ...current,
        executiveIds: exists
          ? current.executiveIds.filter((item) => item !== id)
          : [...current.executiveIds, id],
      };
    });
    setError(null);
  }

  function goNext() {
    if (!step) {
      return;
    }

    const message = validateLaunchStep(step.id, draft);
    if (message) {
      setError(message);
      return;
    }

    if (step.id === "mission") {
      void launch();
      return;
    }

    if (step.id === "goal" && officeOff) {
      patch({ aiEnabled: false, executiveIds: [] });
      setIndex(launchSteps.findIndex((item) => item.id === "mission"));
      return;
    }

    if (step.id === "ai" && draft.aiEnabled === false) {
      setIndex(launchSteps.findIndex((item) => item.id === "mission"));
      return;
    }

    setIndex((current) => Math.min(current + 1, launchSteps.length - 1));
  }

  function goBack() {
    setError(null);
    if (step?.id === "mission" && officeOff) {
      setIndex(launchSteps.findIndex((item) => item.id === "goal"));
      return;
    }
    if (step?.id === "mission" && draft.aiEnabled === false) {
      setIndex(launchSteps.findIndex((item) => item.id === "ai"));
      return;
    }
    setIndex((current) => Math.max(current - 1, 0));
  }

  async function launch() {
    const message = validateLaunchStep("mission", draft);
    if (message) {
      setError(message);
      return;
    }

    const result = await foundCompanyAction(draft);
    if (result.error || !result.slug) {
      setError(result.error ?? "Could not found the company.");
      return;
    }

    router.refresh();
    setSlug(result.slug);
    setSequenceIndex(0);
    setSequenceDone(false);
    setLaunching(true);
  }

  return (
    <>
      {launching ? (
        <LaunchSequence activeIndex={sequenceIndex} complete={sequenceDone} />
      ) : null}
      <WizardShell
        currentIndex={index}
        skippedIds={skippedIds}
        error={error}
        launching={launching}
        onBack={goBack}
        onNext={goNext}
      >
        {step?.id === "product" ? (
          <StepOptionGrid
            options={products}
            value={draft.productId}
            onChange={(productId) => patch({ productId })}
          />
        ) : null}
        {step?.id === "name" ? (
          <StepName
            value={draft.name}
            onChange={(name) => patch({ name })}
            onSubmit={goNext}
          />
        ) : null}
        {step?.id === "category" ? (
          <StepOptionGrid
            options={categoryOptions}
            value={draft.categoryId}
            onChange={(categoryId) => patch({ categoryId })}
          />
        ) : null}
        {step?.id === "stage" ? (
          <StepOptionGrid
            options={stageOptions}
            value={draft.stageId}
            onChange={(stageId) => patch({ stageId })}
          />
        ) : null}
        {step?.id === "goal" ? (
          <StepOptionGrid
            options={goalOptions}
            value={draft.goalId}
            onChange={(goalId) => patch({ goalId })}
          />
        ) : null}
        {step?.id === "ai" ? (
          <StepEnableAi
            value={draft.aiEnabled}
            onChange={(aiEnabled) =>
              patch({
                aiEnabled,
                executiveIds: aiEnabled ? draft.executiveIds : [],
              })
            }
          />
        ) : null}
        {step?.id === "team" ? (
          <StepExecutiveTeam
            enabled={Boolean(draft.aiEnabled)}
            selected={draft.executiveIds}
            onToggle={toggleExecutive}
          />
        ) : null}
        {step?.id === "mission" ? <StepMissionControl draft={draft} /> : null}
      </WizardShell>
    </>
  );
}
