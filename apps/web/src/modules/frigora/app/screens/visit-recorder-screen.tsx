import type { ReactNode } from "react";
import Link from "next/link";
import { PageFrame } from "@/core";
import { Stack } from "@/core/layout";
import { FinishVisitForm } from "@/modules/frigora/app/forms/finish-visit-form";
import { RecordCorrectiveActionForm } from "@/modules/frigora/app/forms/record-corrective-action-form";
import { RecordCustomerAcknowledgementForm } from "@/modules/frigora/app/forms/record-customer-acknowledgement-form";
import { RecordVisitEvidenceForm } from "@/modules/frigora/app/forms/record-visit-evidence-form";
import { RemoveVisitEvidenceForm } from "@/modules/frigora/app/forms/remove-visit-evidence-form";
import { RecordFieldCaptureForm } from "@/modules/frigora/app/forms/record-field-capture-form";
import { RecordOperationalConditionForm } from "@/modules/frigora/app/forms/record-operational-condition-form";
import { RecordPartUsageForm } from "@/modules/frigora/app/forms/record-part-usage-form";
import { RecordRecommendedActionForm } from "@/modules/frigora/app/forms/record-recommended-action-form";
import { RecordRefrigerantEventForm } from "@/modules/frigora/app/forms/record-refrigerant-event-form";
import { RecordTechnicalFindingForm } from "@/modules/frigora/app/forms/record-technical-finding-form";
import { RecordVisitOutcomeForm } from "@/modules/frigora/app/forms/record-visit-outcome-form";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import type { VisitRecorderView } from "@/modules/frigora/app/views";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4"
    >
      <Stack gap="compact">
        <div>
          <h2 className="ids-label text-foreground">{title}</h2>
          <p className="ids-caption text-muted">{description}</p>
        </div>
        {children}
      </Stack>
    </section>
  );
}

function RecordList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="ids-caption text-muted">None recorded yet.</p>;
  }
  return (
    <ul className="list-none space-y-2">
      {items.map((item, index) => (
        <li
          key={index}
          className="ids-body rounded-[var(--ids-foundation-radius-sm)] bg-[var(--ids-foundation-surface-subtle)] p-3"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function VisitRecorderScreen({
  ctx,
  view,
}: {
  ctx: FrigoraOpsContext;
  view: VisitRecorderView;
}) {
  const {
    workOrder,
    customer,
    site,
    asset,
    visit,
    attending,
    otherOpenVisits,
    fieldCaptures,
    technicalFindings,
    correctiveActions,
    partUsages,
    refrigerantEvents,
    visitOutcome,
    recommendedActions,
    acknowledgements,
    evidence,
    currentOperationalCondition,
    visitOperationalConditions,
    canRecord,
  } = view;

  const workBase = `/ventures/${ctx.ventureId}/work/${workOrder.id}`;
  const primaryAssetId = workOrder.primaryAssetId;

  const formProps = {
    workspaceId: ctx.workspaceId,
    ventureId: ctx.ventureId,
    workOrderId: workOrder.id,
    visitId: visit.id,
    primaryAssetId,
  };

  return (
    <PageFrame
      page="Visit recorder"
      kicker={workOrder.workReference}
      title="Visit recorder"
      description={`${customer?.displayName ?? "Customer"} · ${site?.name ?? "Site"}`}
      meta={visit.status}
      ventureId={ctx.ventureId}
      actions={
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Link href={`/ventures/${ctx.ventureId}/work/assigned`} className="vos-btn-secondary">
            My Work
          </Link>
          <Link href={workBase} className="vos-btn-secondary">
            Work order
          </Link>
        </div>
      }
    >
      <Stack gap="section">
        {otherOpenVisits.length > 0 ? (
          <div className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4">
            <p className="ids-caption text-muted">
              Other open visits on this work order:
            </p>
            <ul className="mt-2 space-y-1">
              {otherOpenVisits.map((other) => (
                <li key={other.id}>
                  <Link
                    href={`${workBase}/visit/${other.id}`}
                    className="ids-body underline-offset-2 hover:underline"
                  >
                    {other.arrivedAt} — {other.status}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="ids-caption text-muted">Visit status</dt>
            <dd className="ids-body">{visit.status}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Attending</dt>
            <dd className="ids-body">{attending?.name ?? visit.attendingUserId}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Arrived</dt>
            <dd className="ids-body">{visit.arrivedAt}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Departed</dt>
            <dd className="ids-body">{visit.departedAt ?? "—"}</dd>
          </div>
          {asset ? (
            <div className="sm:col-span-2">
              <dt className="ids-caption text-muted">Asset</dt>
              <dd className="ids-body">
                {asset.tag}
                {asset.name ? ` — ${asset.name}` : ""}
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="ids-caption text-muted">Reported condition</dt>
            <dd className="ids-body whitespace-pre-wrap">
              {workOrder.reportedCondition ?? "—"}
            </dd>
          </div>
        </dl>

        {!canRecord ? (
          <p className="ids-caption text-muted">
            This visit is read-only. Sections below show persisted records only.
          </p>
        ) : (
          <p className="ids-caption text-muted">
            Independent truth sections — none are required before finishing the visit.
          </p>
        )}

        <Section
          title="Observations & measurements"
          description="What was observed or measured."
        >
          <RecordList
            items={fieldCaptures.map((row) => {
              if (row.captureKind === "measurement") {
                return `${row.captureCode}: ${row.valueNumeric} ${row.valueUnit ?? ""} (${row.observedAt})`;
              }
              return `${row.captureCode}: ${row.description ?? ""} (${row.observedAt})`;
            })}
          />
          {canRecord ? <RecordFieldCaptureForm {...formProps} /> : null}
        </Section>

        <Section title="Technical findings" description="What the technician concluded.">
          <RecordList
            items={technicalFindings.map(
              (row) => `${row.findingKind}: ${row.description} (${row.assertedAt})`,
            )}
          />
          {canRecord ? <RecordTechnicalFindingForm {...formProps} /> : null}
        </Section>

        <Section title="Corrective actions" description="What was actually done.">
          <RecordList
            items={correctiveActions.map(
              (row) => `${row.description} (${row.performedAt})`,
            )}
          />
          {canRecord ? <RecordCorrectiveActionForm {...formProps} /> : null}
        </Section>

        <Section title="Parts & materials" description="What part or material was actually used.">
          <RecordList
            items={partUsages.map(
              (row) =>
                `${row.partDescription} — ${row.quantity} ${row.quantityUnit} (${row.usedAt})`,
            )}
          />
          {canRecord ? <RecordPartUsageForm {...formProps} /> : null}
        </Section>

        <Section
          title="Refrigerant"
          description="What refrigerant handling actually occurred."
        >
          <RecordList
            items={refrigerantEvents.map(
              (row) =>
                `${row.eventKind}: ${row.quantityKg} kg ${row.refrigerantType} (${row.occurredAt})`,
            )}
          />
          {canRecord ? <RecordRefrigerantEventForm {...formProps} /> : null}
        </Section>

        <Section
          title="Visit outcome"
          description="What resulting operational state was true."
        >
          {visitOutcome ? (
            <p className="ids-body">
              {visitOutcome.description} ({visitOutcome.outcomeAt})
            </p>
          ) : (
            <p className="ids-caption text-muted">No outcome recorded yet.</p>
          )}
          {canRecord && !visitOutcome ? <RecordVisitOutcomeForm {...formProps} /> : null}
        </Section>

        {asset ? (
          <Section
            title="Operational condition"
            description="What operational condition a human asserted for the asset."
          >
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="ids-caption text-muted">Asset identity status</dt>
                <dd className="ids-body">{asset.status}</dd>
              </div>
              <div>
                <dt className="ids-caption text-muted">Current operational condition</dt>
                <dd className="ids-body">
                  {currentOperationalCondition?.conditionKind ?? "—"}
                </dd>
              </div>
            </dl>
            <p className="ids-caption text-muted">
              Asset identity status is not operational condition.
            </p>
            <RecordList
              items={visitOperationalConditions.map(
                (row) =>
                  `${row.conditionKind}${row.notes ? `: ${row.notes}` : ""} (${row.assertedAt})`,
              )}
            />
            {canRecord ? (
              <RecordOperationalConditionForm
                workspaceId={ctx.workspaceId}
                ventureId={ctx.ventureId}
                workOrderId={workOrder.id}
                visitId={visit.id}
                assetId={asset.id}
              />
            ) : null}
          </Section>
        ) : null}

        <Section
          title="Recommended actions"
          description="What a human recommends should happen next."
        >
          <RecordList
            items={recommendedActions.map(
              (row) => `${row.description} (${row.recommendedAt})`,
            )}
          />
          {canRecord ? <RecordRecommendedActionForm {...formProps} /> : null}
        </Section>

        <Section
          title="Evidence & Photos"
          description="Files recorded during this visit for provenance and traceability."
        >
          {evidence.length === 0 ? (
            <p className="ids-caption text-muted">No evidence recorded yet.</p>
          ) : (
            <ul className="list-none space-y-3">
              {evidence.map((row) => (
                <li
                  key={row.id}
                  className="rounded-[var(--ids-foundation-radius-sm)] bg-[var(--ids-foundation-surface-subtle)] p-3"
                >
                  <div className="ids-body">{row.originalFilename}</div>
                  <div className="ids-caption text-muted">
                    {row.category}
                    {row.description ? ` · ${row.description}` : ""} · captured {row.capturedAt}
                  </div>
                  <div className="mt-2">
                    <a
                      href={`/api/stored-objects/${row.storedObjectId}`}
                      className="vos-btn-secondary inline-block"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open file
                    </a>
                  </div>
                  {canRecord ? (
                    <div className="mt-2">
                      <RemoveVisitEvidenceForm
                        workspaceId={ctx.workspaceId}
                        ventureId={ctx.ventureId}
                        workOrderId={workOrder.id}
                        visitId={visit.id}
                        evidenceId={row.id}
                        filename={row.originalFilename}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canRecord ? (
            <RecordVisitEvidenceForm
              workspaceId={ctx.workspaceId}
              ventureId={ctx.ventureId}
              workOrderId={workOrder.id}
              visitId={visit.id}
              primaryAssetId={primaryAssetId}
            />
          ) : (
            <p className="ids-caption text-muted">
              Evidence is read-only after departure.
            </p>
          )}
        </Section>

        <Section
          title="Customer acknowledgement"
          description="What a customer or site representative acknowledged about the visit."
        >
          <RecordList
            items={acknowledgements.map(
              (row) =>
                `${row.acknowledgerName}: ${row.acknowledgementText} (${row.acknowledgedAt})`,
            )}
          />
          {canRecord ? (
            <RecordCustomerAcknowledgementForm
              workspaceId={ctx.workspaceId}
              ventureId={ctx.ventureId}
              workOrderId={workOrder.id}
              visitId={visit.id}
            />
          ) : null}
        </Section>

        <Section title="Finish visit" description="Ends the visit attendance episode.">
          {canRecord ? (
            <FinishVisitForm
              workspaceId={ctx.workspaceId}
              ventureId={ctx.ventureId}
              workOrderId={workOrder.id}
              visitId={visit.id}
            />
          ) : (
            <p className="ids-caption text-muted">
              Visit finished. Work order status remains {workOrder.status}.
            </p>
          )}
        </Section>
      </Stack>
    </PageFrame>
  );
}
