"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  activateOfficeCustomerAccessFormAction,
  correctOfficeQuotationContactFormAction,
  correctOfficeQuotationFormAction,
  createOfficeQuotationContactFormAction,
  createOfficeQuotationFormAction,
  designateOfficeQuotationContactFormAction,
  issueOfficeQuotationFormAction,
  recordOfficeSupervisedVerificationFormAction,
  revokeOfficeCustomerAccessFormAction,
  revokeOfficeQuotationDesignationFormAction,
  revokeOfficeSupervisedVerificationFormAction,
  reviseOfficeQuotationFormAction,
  type OfficeQuotationFormState,
} from "@/modules/frigora/app/quotation-office-actions";
import {
  formatQuantityMilli,
  formatZarMinor,
  type OfficeQuotationFieldValues,
} from "@/modules/frigora/app/quotation-office";
import type { FrigoraPersistedQuoteVersion } from "@/modules/frigora/types";

function CommercialFields({
  values,
  initial,
}: {
  values?: OfficeQuotationFieldValues;
  initial?: FrigoraPersistedQuoteVersion;
}) {
  const commercial = initial?.commercial;
  const value = (key: keyof OfficeQuotationFieldValues, fallback = "") =>
    values?.[key] ?? fallback;

  return (
    <>
      <Field>
        Description
        <textarea
          name="description"
          required
          rows={3}
          defaultValue={value("description", initial?.description ?? "")}
          className="vos-field"
        />
      </Field>
      <Field>
        Labour quantity
        <input
          name="labourQuantity"
          required
          inputMode="decimal"
          defaultValue={value(
            "labourQuantity",
            commercial ? formatQuantityMilli(commercial.labourQuantityMilli) : "",
          )}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Labour unit
        <input
          name="labourUnit"
          required
          defaultValue={value("labourUnit", commercial?.labourUnit ?? "")}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Labour rate (R per unit)
        <input
          name="labourRate"
          required
          inputMode="decimal"
          defaultValue={value(
            "labourRate",
            commercial ? formatZarMinor(commercial.labourRateMinor) : "",
          )}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Travel kilometres
        <input
          name="travelKilometres"
          required
          inputMode="decimal"
          defaultValue={value(
            "travelKilometres",
            commercial ? formatQuantityMilli(commercial.travelKilometresMilli) : "",
          )}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Distance basis
        <select
          name="distanceBasis"
          required
          defaultValue={value("distanceBasis", commercial?.distanceBasis ?? "")}
          className="vos-field"
        >
          <option value="">Select one-way or return</option>
          <option value="one_way">One-way</option>
          <option value="return">Return</option>
        </select>
        <span className="ids-caption text-muted">
          Record the billable kilometres for that basis. Return distance is not doubled.
        </span>
      </Field>
      <Field>
        Travel rate (R per kilometre)
        <input
          name="travelRate"
          required
          inputMode="decimal"
          defaultValue={value(
            "travelRate",
            commercial ? formatZarMinor(commercial.travelRateMinor) : "",
          )}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Tax treatment
        <select
          name="taxTreatment"
          required
          defaultValue={value("taxTreatment", commercial?.taxTreatment ?? "")}
          className="vos-field"
        >
          <option value="">Select a tax treatment</option>
          <option value="not_registered">Not registered</option>
          <option value="configured_rule">Configured rule snapshot</option>
        </select>
        <span className="ids-caption text-muted">
          This choice is stored with the draft. It is not proof that the treatment is legally applicable.
        </span>
      </Field>
      <Field>
        Tax rule id
        <input
          name="taxRuleId"
          defaultValue={value("taxRuleId", commercial?.taxRuleId ?? "")}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Tax rule version
        <input
          name="taxRuleVersion"
          defaultValue={value("taxRuleVersion", commercial?.taxRuleVersion ?? "")}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Tax rate numerator
        <input
          name="taxRateNumerator"
          inputMode="numeric"
          defaultValue={value(
            "taxRateNumerator",
            commercial?.taxRateNumerator == null ? "" : String(commercial.taxRateNumerator),
          )}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Tax rate denominator
        <input
          name="taxRateDenominator"
          inputMode="numeric"
          defaultValue={value(
            "taxRateDenominator",
            commercial?.taxRateDenominator == null ? "" : String(commercial.taxRateDenominator),
          )}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
      <Field>
        Entered tax amount (R, optional)
        <input
          name="enteredTaxAmount"
          inputMode="decimal"
          defaultValue={value(
            "enteredTaxAmount",
            commercial?.taxTreatment === "configured_rule" && commercial.taxAmountMinor > 0
              ? formatZarMinor(commercial.taxAmountMinor)
              : "",
          )}
          className="vos-field"
          autoComplete="off"
        />
      </Field>
    </>
  );
}

function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="ids-caption text-danger" role="alert">
      {error}
    </p>
  );
}

export function CreateQuotationForm({
  workspaceId,
  ventureId,
  sources,
}: {
  workspaceId: string;
  ventureId: string;
  sources: ReadonlyArray<{ recommendedActionId: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    createOfficeQuotationFormAction,
    {} as OfficeQuotationFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <Stack gap="tight">
        <Field>
          Recommended action
          <select
            name="recommendedActionId"
            required
            defaultValue={state.values?.recommendedActionId ?? ""}
            className="vos-field"
          >
            <option value="">Select a recommended action</option>
            {sources.map((source) => (
              <option key={source.recommendedActionId} value={source.recommendedActionId}>
                {source.label}
              </option>
            ))}
          </select>
        </Field>
        <CommercialFields values={state.values} />
        <FormError error={state.error} />
        <Button type="submit" disabled={pending || sources.length === 0}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </Stack>
    </Form>
  );
}

export function CorrectQuotationForm({
  workspaceId,
  ventureId,
  quotationId,
  version,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  version: FrigoraPersistedQuoteVersion;
}) {
  const [state, formAction, pending] = useActionState(
    correctOfficeQuotationFormAction,
    {} as OfficeQuotationFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="expectedCurrentVersion" value={String(version.version)} />
      <Stack gap="tight">
        <CommercialFields values={state.values} initial={version} />
        <FormError error={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save draft correction"}
        </Button>
      </Stack>
    </Form>
  );
}

export function ReviseQuotationForm({
  workspaceId,
  ventureId,
  quotationId,
  version,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  version: FrigoraPersistedQuoteVersion;
}) {
  const [state, formAction, pending] = useActionState(
    reviseOfficeQuotationFormAction,
    {} as OfficeQuotationFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="expectedCurrentVersion" value={String(version.version)} />
      <Stack gap="tight">
        <p className="ids-caption text-muted">
          Revision creates a new draft and keeps the historical issued version unchanged.
        </p>
        <CommercialFields values={state.values} initial={version} />
        <FormError error={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Revising…" : "Start revision"}
        </Button>
      </Stack>
    </Form>
  );
}

export function SendQuotationForm({
  workspaceId,
  ventureId,
  quotationId,
  version,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  version: number;
}) {
  const [state, formAction, pending] = useActionState(
    issueOfficeQuotationFormAction,
    {} as OfficeQuotationFormState,
  );

  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="expectedCurrentVersion" value={String(version)} />
      <Stack gap="tight">
        <Field>
          Recipient
          <input name="recipient" type="email" required className="vos-field" autoComplete="off" />
        </Field>
        <p className="ids-caption text-muted" role="status">
          Issue checks the verified tax configuration for this venture and records a held delivery. It does not email this recipient. A typed rate is not that configuration. A blocked or failed issue stays unissued.
        </p>
        <FormError error={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Preparing…" : "Prepare issue"}
        </Button>
      </Stack>
    </Form>
  );
}

export function ActivateCustomerAccessForm({
  workspaceId,
  ventureId,
  quotationId,
  version,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  version: number;
}) {
  const [state, formAction, pending] = useActionState(
    activateOfficeCustomerAccessFormAction,
    {} as OfficeQuotationFormState,
  );
  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="expectedCurrentVersion" value={String(version)} />
      <Stack gap="tight">
        <p className="ids-caption text-muted">
          Supervised pilot test link. It is shown once, it is not emailed, and it is not mailbox delivery. Share it only through the agreed supervised process. The office user is responsible for that handoff.
        </p>
        <FormError error={state.error} />
        {state.testOnlyPath ? (
          <p className="break-all text-sm" role="status">
            Supervised pilot test link, shown once and not emailed: {state.testOnlyPath}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Activate supervised test link"}
        </Button>
      </Stack>
    </Form>
  );
}

export function RevokeCustomerAccessForm({
  workspaceId,
  ventureId,
  quotationId,
  grantId,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  grantId: string;
}) {
  const [state, formAction, pending] = useActionState(
    revokeOfficeCustomerAccessFormAction,
    {} as OfficeQuotationFormState,
  );
  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="grantId" value={grantId} />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Revoking…" : "Revoke"}
      </Button>
    </Form>
  );
}

function ContactIdentityFields({
  workspaceId,
  ventureId,
  quotationId,
  contactId,
  displayName,
  email,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  contactId?: string;
  displayName?: string;
  email?: string;
}) {
  return (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}
      <Field>
        Display name
        <input name="displayName" required defaultValue={displayName ?? ""} className="vos-field" />
      </Field>
      <Field>
        Email
        <input name="email" type="email" required defaultValue={email ?? ""} className="vos-field" />
      </Field>
    </>
  );
}

export function CreateQuotationContactForm({
  workspaceId,
  ventureId,
  quotationId,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createOfficeQuotationContactFormAction,
    {} as OfficeQuotationFormState,
  );
  return (
    <Form action={formAction} gap="tight">
      <Stack gap="tight">
        <ContactIdentityFields workspaceId={workspaceId} ventureId={ventureId} quotationId={quotationId} />
        <FormError error={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create contact"}
        </Button>
      </Stack>
    </Form>
  );
}

export function CorrectQuotationContactForm({
  workspaceId,
  ventureId,
  quotationId,
  contactId,
  displayName,
  email,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  contactId: string;
  displayName: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    correctOfficeQuotationContactFormAction,
    {} as OfficeQuotationFormState,
  );
  return (
    <Form action={formAction} gap="tight">
      <Stack gap="tight">
        <ContactIdentityFields
          workspaceId={workspaceId}
          ventureId={ventureId}
          quotationId={quotationId}
          contactId={contactId}
          displayName={displayName}
          email={email}
        />
        <FormError error={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Correct contact"}
        </Button>
      </Stack>
    </Form>
  );
}

export function RecordSupervisedVerificationForm({
  workspaceId,
  ventureId,
  quotationId,
  contactId,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  contactId: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordOfficeSupervisedVerificationFormAction,
    {} as OfficeQuotationFormState,
  );
  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="contactId" value={contactId} />
      <Stack gap="tight">
        <p className="ids-caption text-muted">
          This records supervised verification by telephone or in person. It does not verify the mailbox and does not set email verification.
        </p>
        <Field>
          Method
          <select name="method" required defaultValue="telephone" className="vos-field">
            <option value="telephone">Telephone</option>
            <option value="in_person">In person</option>
          </select>
        </Field>
        <Field>
          Evidence note
          <input name="evidenceNote" required maxLength={240} className="vos-field" />
        </Field>
        <FormError error={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record supervised verification"}
        </Button>
      </Stack>
    </Form>
  );
}

export function RevokeSupervisedVerificationForm({
  workspaceId,
  ventureId,
  quotationId,
  contactId,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  contactId: string;
}) {
  const [state, formAction, pending] = useActionState(
    revokeOfficeSupervisedVerificationFormAction,
    {} as OfficeQuotationFormState,
  );
  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="contactId" value={contactId} />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Revoking…" : "Revoke supervised verification"}
      </Button>
    </Form>
  );
}

export function DesignateQuotationContactForm({
  workspaceId,
  ventureId,
  quotationId,
  contactId,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  contactId: string;
}) {
  const [state, formAction, pending] = useActionState(
    designateOfficeQuotationContactFormAction,
    {} as OfficeQuotationFormState,
  );
  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="contactId" value={contactId} />
      <Stack gap="tight">
        <Field>
          Designation basis
          <input name="basis" required className="vos-field" />
        </Field>
        <FormError error={state.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Designating…" : "Designate authorised contact"}
        </Button>
      </Stack>
    </Form>
  );
}

export function RevokeQuotationDesignationForm({
  workspaceId,
  ventureId,
  quotationId,
  contactId,
}: {
  workspaceId: string;
  ventureId: string;
  quotationId: string;
  contactId: string;
}) {
  const [state, formAction, pending] = useActionState(
    revokeOfficeQuotationDesignationFormAction,
    {} as OfficeQuotationFormState,
  );
  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="contactId" value={contactId} />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Revoking…" : "Revoke designation"}
      </Button>
    </Form>
  );
}
