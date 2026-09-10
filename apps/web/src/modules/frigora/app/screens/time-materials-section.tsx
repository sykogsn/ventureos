"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  setPartUsageUnitChargeFormAction,
  setRefrigerantEventChargePerKgFormAction,
  setVisitLabourHourlyChargeFormAction,
  type CommercialFormState,
} from "@/modules/frigora/app/commercial-mutation-actions";
import {
  centsToInput,
  formatZarCents,
  type FrigoraTimeMaterialsSummary,
} from "@/modules/frigora/time-materials";

function ChargeInputForm({
  workspaceId,
  ventureId,
  workOrderId,
  action,
  hidden,
  amountName,
  label,
  defaultValue,
  submitLabel,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  action: (
    prev: CommercialFormState,
    formData: FormData,
  ) => Promise<CommercialFormState>;
  hidden: Record<string, string>;
  amountName: string;
  label: string;
  defaultValue?: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as CommercialFormState);
  return (
    <Form action={formAction} gap="tight">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Field>
        {label}
        <input
          name={amountName}
          className="vos-field"
          inputMode="decimal"
          required
          defaultValue={state.values?.[amountName] ?? defaultValue ?? ""}
        />
      </Field>
      {state.error ? (
        <p className="ids-caption text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="vos-btn-secondary">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </Form>
  );
}

export function TimeMaterialsSection({
  workspaceId,
  ventureId,
  workOrderId,
  summary,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  summary: FrigoraTimeMaterialsSummary;
}) {
  return (
    <section className="space-y-4 rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4">
      <Stack gap="compact">
        <h2 className="ids-label text-foreground">Time &amp; materials</h2>
        <p className="ids-caption text-muted">
          Customer ZAR charge derived from Visit, PartUsage, and added RefrigerantEvent
          evidence. Completeness is independent of WorkOrder status. Catalogue defaults do
          not rewrite historical snapshots; use override only for intentional correction.
        </p>
      </Stack>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="ids-caption text-muted">Labour</dt>
          <dd className="ids-body">{formatZarCents(summary.labourCents)}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Parts</dt>
          <dd className="ids-body">{formatZarCents(summary.partsCents)}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Refrigerant (added)</dt>
          <dd className="ids-body">{formatZarCents(summary.refrigerantCents)}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Known subtotal</dt>
          <dd className="ids-body">{formatZarCents(summary.knownSubtotalCents)}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Commercial completeness</dt>
          <dd className="ids-body">
            {summary.completeness === "complete" ? "COMPLETE" : "INCOMPLETE"}
          </dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Final T&amp;M total</dt>
          <dd className="ids-body">
            {summary.totalCents != null
              ? formatZarCents(summary.totalCents)
              : "Unavailable until all chargeable lines are priced"}
          </dd>
        </div>
      </dl>

      {summary.unpriced.length > 0 ? (
        <div className="space-y-2">
          <h3 className="ids-caption text-muted">Unpriced chargeable evidence</h3>
          <ul className="list-none space-y-3">
            {summary.unpriced.map((item) => (
              <li
                key={`${item.kind}-${item.evidenceId}`}
                className="rounded-[var(--ids-foundation-radius-sm)] bg-[var(--ids-foundation-surface-subtle)] p-3"
              >
                <p className="ids-body">
                  UNPRICED · {item.label} · {item.kind} · {item.evidenceId}
                </p>
                {item.kind === "labour" ? (
                  <ChargeInputForm
                    workspaceId={workspaceId}
                    ventureId={ventureId}
                    workOrderId={workOrderId}
                    action={setVisitLabourHourlyChargeFormAction}
                    hidden={{ visitId: item.evidenceId }}
                    amountName="labourHourlyCharge"
                    label="Labour hourly charge (R)"
                    submitLabel="Save charge"
                  />
                ) : null}
                {item.kind === "part" ? (
                  <ChargeInputForm
                    workspaceId={workspaceId}
                    ventureId={ventureId}
                    workOrderId={workOrderId}
                    action={setPartUsageUnitChargeFormAction}
                    hidden={{ partUsageId: item.evidenceId }}
                    amountName="unitCharge"
                    label="Unit charge (R)"
                    submitLabel="Save charge"
                  />
                ) : null}
                {item.kind === "refrigerant" ? (
                  <ChargeInputForm
                    workspaceId={workspaceId}
                    ventureId={ventureId}
                    workOrderId={workOrderId}
                    action={setRefrigerantEventChargePerKgFormAction}
                    hidden={{ eventId: item.evidenceId }}
                    amountName="chargePerKg"
                    label="Charge per kg (R)"
                    submitLabel="Save charge"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="ids-caption text-muted">Commercial snapshots</h3>
        <p className="ids-caption text-muted">
          Historical snapshot values are shown below. Override replaces only the chosen
          snapshot; operational quantities and catalogue defaults stay unchanged.
        </p>
        <ul className="list-none space-y-3">
          {summary.labourLines.map((line) => (
            <li
              key={line.visitId}
              className="rounded-[var(--ids-foundation-radius-sm)] bg-[var(--ids-foundation-surface-subtle)] p-3"
            >
              <p className="ids-body">
                Labour Visit {line.visitId}
                {line.priced && line.labourHourlyChargeCents != null
                  ? ` · snapshot ${formatZarCents(line.labourHourlyChargeCents)}/hour · line ${formatZarCents(line.amountCents ?? 0)}`
                  : " · unpriced"}
              </p>
              {line.priced && line.labourHourlyChargeCents != null ? (
                <ChargeInputForm
                  workspaceId={workspaceId}
                  ventureId={ventureId}
                  workOrderId={workOrderId}
                  action={setVisitLabourHourlyChargeFormAction}
                  hidden={{ visitId: line.visitId }}
                  amountName="labourHourlyCharge"
                  label="Override labour hourly charge (R)"
                  defaultValue={centsToInput(line.labourHourlyChargeCents)}
                  submitLabel="Save override"
                />
              ) : null}
            </li>
          ))}
          {summary.partLines.map((line) => (
            <li
              key={line.partUsageId}
              className="rounded-[var(--ids-foundation-radius-sm)] bg-[var(--ids-foundation-surface-subtle)] p-3"
            >
              <p className="ids-body">
                PartUsage {line.partUsageId} · {line.label} · qty {line.quantity}
                {line.priced && line.unitChargeCents != null
                  ? ` · snapshot ${formatZarCents(line.unitChargeCents)}/each · line ${formatZarCents(line.amountCents ?? 0)}`
                  : " · unpriced"}
              </p>
              {line.priced && line.unitChargeCents != null ? (
                <ChargeInputForm
                  workspaceId={workspaceId}
                  ventureId={ventureId}
                  workOrderId={workOrderId}
                  action={setPartUsageUnitChargeFormAction}
                  hidden={{ partUsageId: line.partUsageId }}
                  amountName="unitCharge"
                  label="Override unit charge (R)"
                  defaultValue={centsToInput(line.unitChargeCents)}
                  submitLabel="Save override"
                />
              ) : null}
            </li>
          ))}
          {summary.refrigerantLines
            .filter((line) => line.chargeable)
            .map((line) => (
              <li
                key={line.refrigerantEventId}
                className="rounded-[var(--ids-foundation-radius-sm)] bg-[var(--ids-foundation-surface-subtle)] p-3"
              >
                <p className="ids-body">
                  RefrigerantEvent {line.refrigerantEventId} ({line.eventKind}) ·{" "}
                  {line.quantityKg} kg
                  {line.priced && line.chargePerKgCents != null
                    ? ` · snapshot ${formatZarCents(line.chargePerKgCents)}/kg · line ${formatZarCents(line.amountCents)}`
                    : " · unpriced"}
                </p>
                {line.priced && line.chargePerKgCents != null ? (
                  <ChargeInputForm
                    workspaceId={workspaceId}
                    ventureId={ventureId}
                    workOrderId={workOrderId}
                    action={setRefrigerantEventChargePerKgFormAction}
                    hidden={{ eventId: line.refrigerantEventId }}
                    amountName="chargePerKg"
                    label="Override charge per kg (R)"
                    defaultValue={centsToInput(line.chargePerKgCents)}
                    submitLabel="Save override"
                  />
                ) : null}
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}
