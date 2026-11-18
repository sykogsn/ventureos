"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  approveTaxRuleFormAction,
  revokeTaxFormAction,
  saveTaxDraftFormAction,
  submitTaxReviewFormAction,
  verifyTaxFormAction,
  type TaxConfigurationFormState,
} from "@/modules/frigora/app/tax-configuration-actions";
import { SARS_ZA_VAT_STANDARD_RULE } from "@/modules/frigora/tax-configuration";

function Alert({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="ids-caption text-danger" role="alert">{error}</p>;
}

function Fields({ workspaceId, ventureId }: { workspaceId: string; ventureId: string }) {
  return (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="jurisdiction" value="ZA" />
      <Field>
        Registration state
        <select name="registrationState" required className="vos-field" defaultValue="unverified">
          <option value="unverified">Unverified</option>
          <option value="pending_review">Pending review</option>
          <option value="registered">Registered</option>
          <option value="not_registered">Not registered</option>
        </select>
        <span className="ids-caption text-muted">
          Registered and not-registered can be saved as a draft. They become effective only when verified with evidence.
        </span>
      </Field>
      <Field>
        Registration number
        <input name="registrationNumber" className="vos-field" autoComplete="off" />
      </Field>
      <Field>
        Liability date
        <input name="liabilityDate" type="date" className="vos-field" />
      </Field>
      <Field>
        Tax rule
        <select name="taxRuleId" className="vos-field" defaultValue="">
          <option value="">No VAT rule</option>
          <option value={SARS_ZA_VAT_STANDARD_RULE.id}>
            SARS standard rate {SARS_ZA_VAT_STANDARD_RULE.rateNumerator}/{SARS_ZA_VAT_STANDARD_RULE.rateDenominator}, effective {SARS_ZA_VAT_STANDARD_RULE.effectiveFrom}
          </option>
        </select>
      </Field>
      <Field>
        Evidence reference
        <input name="evidenceReference" className="vos-field" autoComplete="off" />
        <span className="ids-caption text-muted">
          Record where the registration evidence is kept. Do not paste a secret. A SARS web page is not this evidence.
        </span>
      </Field>
    </>
  );
}

export function TaxConfigurationForms({
  workspaceId,
  ventureId,
  verifiedId,
}: {
  workspaceId: string;
  ventureId: string;
  verifiedId: string | null;
}) {
  const [draft, saveDraft, draftPending] = useActionState(saveTaxDraftFormAction, {} as TaxConfigurationFormState);
  const [review, submitReview, reviewPending] = useActionState(submitTaxReviewFormAction, {} as TaxConfigurationFormState);
  const [verified, verify, verifyPending] = useActionState(verifyTaxFormAction, {} as TaxConfigurationFormState);
  const [approved, approve, approvePending] = useActionState(approveTaxRuleFormAction, {} as TaxConfigurationFormState);
  const [revoked, revoke, revokePending] = useActionState(revokeTaxFormAction, {} as TaxConfigurationFormState);

  return (
    <Stack gap="section">
      <Form action={approve} gap="tight">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="ventureId" value={ventureId} />
        <p className="ids-caption text-muted">
          Approving the public SARS reference lets a later verified registration select it. Approval does not verify this venture and does not permit sending on its own.
        </p>
        <Alert error={approved.error} />
        <Button type="submit" disabled={approvePending}>{approvePending ? "Saving…" : "Approve public rule reference"}</Button>
      </Form>
      <Form action={saveDraft} gap="tight">
        <Fields workspaceId={workspaceId} ventureId={ventureId} />
        <Alert error={draft.error} />
        <Button type="submit" disabled={draftPending}>{draftPending ? "Saving…" : "Save draft"}</Button>
      </Form>
      <Form action={submitReview} gap="tight">
        <Fields workspaceId={workspaceId} ventureId={ventureId} />
        <Alert error={review.error} />
        <Button type="submit" disabled={reviewPending}>{reviewPending ? "Submitting…" : "Submit for review"}</Button>
      </Form>
      <Form action={verify} gap="tight">
        <Fields workspaceId={workspaceId} ventureId={ventureId} />
        <p className="ids-caption text-muted">
          Verification requires evidence and an explicit registered or not-registered state. It is refused while that evidence is missing.
        </p>
        <Alert error={verified.error} />
        <Button type="submit" disabled={verifyPending}>{verifyPending ? "Checking…" : "Verify configuration"}</Button>
      </Form>
      {verifiedId ? (
        <Form action={revoke} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="ventureId" value={ventureId} />
          <input type="hidden" name="configurationId" value={verifiedId} />
          <Alert error={revoked.error} />
          <Button type="submit" disabled={revokePending}>{revokePending ? "Revoking…" : "Revoke verified configuration"}</Button>
        </Form>
      ) : null}
    </Stack>
  );
}
