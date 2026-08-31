import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Fit, Stack } from "@/core/layout";
import { AssignmentControls } from "@/modules/frigora/app/forms/assignment-controls";
import { CreateWorkOrderForm } from "@/modules/frigora/app/forms/create-work-order-form";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import type {
  VisitFactsView,
  WorkCreateOptions,
  WorkOrderDetailView,
  WorkOrderListRow,
} from "@/modules/frigora/app/views";

function VisitFactsReadBack({ facts }: { facts: VisitFactsView }) {
  const { visit, attendee } = facts;

  return (
    <div className="mt-3 border-t border-[var(--ids-foundation-stroke-subtle)] pt-3">
      <Stack gap="compact">
      <p className="ids-caption text-muted">
        {visit.status} · {attendee?.name ?? visit.attendingUserId} · arrived{" "}
        {visit.arrivedAt}
        {visit.departedAt ? ` · departed ${visit.departedAt}` : ""}
      </p>

      {facts.fieldCaptures.length > 0 ? (
        <div>
          <h4 className="ids-caption text-muted">Observations</h4>
          <ul className="ids-body list-none space-y-1">
            {facts.fieldCaptures.map((row) => (
              <li key={row.id}>
                {row.captureKind === "measurement"
                  ? `${row.captureCode}: ${row.valueNumeric} ${row.valueUnit ?? ""}`
                  : `${row.captureCode}: ${row.description ?? ""}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.technicalFindings.length > 0 ? (
        <div>
          <h4 className="ids-caption text-muted">Findings</h4>
          <ul className="ids-body list-none space-y-1">
            {facts.technicalFindings.map((row) => (
              <li key={row.id}>{row.findingKind}: {row.description}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.correctiveActions.length > 0 ? (
        <div>
          <h4 className="ids-caption text-muted">Corrective actions</h4>
          <ul className="ids-body list-none space-y-1">
            {facts.correctiveActions.map((row) => (
              <li key={row.id}>{row.description}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.partUsages.length > 0 ? (
        <div>
          <h4 className="ids-caption text-muted">Parts</h4>
          <ul className="ids-body list-none space-y-1">
            {facts.partUsages.map((row) => (
              <li key={row.id}>
                {row.partDescription} — {row.quantity} {row.quantityUnit}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.refrigerantEvents.length > 0 ? (
        <div>
          <h4 className="ids-caption text-muted">Refrigerant</h4>
          <ul className="ids-body list-none space-y-1">
            {facts.refrigerantEvents.map((row) => (
              <li key={row.id}>
                {row.eventKind}: {row.quantityKg} kg {row.refrigerantType}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.visitOutcome ? (
        <div>
          <h4 className="ids-caption text-muted">Outcome</h4>
          <p className="ids-body">{facts.visitOutcome.description}</p>
        </div>
      ) : null}

      {facts.recommendedActions.length > 0 ? (
        <div>
          <h4 className="ids-caption text-muted">Recommendations</h4>
          <ul className="ids-body list-none space-y-1">
            {facts.recommendedActions.map((row) => (
              <li key={row.id}>{row.description}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.operationalConditions.length > 0 ? (
        <div>
          <h4 className="ids-caption text-muted">Operational condition</h4>
          <ul className="ids-body list-none space-y-1">
            {facts.operationalConditions.map((row) => (
              <li key={row.id}>{row.conditionKind}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.acknowledgements.length > 0 ? (
        <div>
          <h4 className="ids-caption text-muted">Acknowledgement</h4>
          <ul className="ids-body list-none space-y-1">
            {facts.acknowledgements.map((row) => (
              <li key={row.id}>
                {row.acknowledgerName}: {row.acknowledgementText}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </Stack>
    </div>
  );
}

export function WorkListScreen({
  ctx,
  rows,
  error,
}: {
  ctx: FrigoraOpsContext;
  rows: WorkOrderListRow[];
  error?: string;
}) {
  const base = `/ventures/${ctx.ventureId}/work`;

  return (
    <PageFrame
      page="Work"
      kicker="Frigora operations"
      title="Work"
      description="Persisted work orders for this Frigora venture."
      ventureId={ctx.ventureId}
      actions={
        ctx.canWrite ? (
          <Fit>
            <Link href={`${base}/new`} className="vos-btn-primary">
              Create work order
            </Link>
          </Fit>
        ) : undefined
      }
    >
      <Stack gap="section">
        {error ? (
          <p className="ids-caption text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <EmptyCopy title="No work orders yet">
            Create a work order after a customer, site, and optional asset exist.
          </EmptyCopy>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="ids-caption text-muted">
                  <th className="py-2 pr-4 font-medium">Reference</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Kind</th>
                  <th className="py-2 pr-4 font-medium">Customer / site</th>
                  <th className="py-2 pr-4 font-medium">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ workOrder, customer, site, assignee }) => (
                  <tr
                    key={workOrder.id}
                    className="border-t border-[var(--ids-foundation-stroke-subtle)]"
                  >
                    <td className="py-3 pr-4 ids-body">
                      <Link
                        href={`${base}/${workOrder.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {workOrder.workReference}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 ids-caption text-muted">{workOrder.status}</td>
                    <td className="py-3 pr-4 ids-caption text-muted">{workOrder.workKind}</td>
                    <td className="py-3 pr-4 ids-body">
                      {customer?.displayName ?? "—"}
                      <span className="ids-caption text-muted">
                        {" "}
                        / {site?.name ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 ids-body">
                      {assignee?.name ?? "Unassigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Stack>
    </PageFrame>
  );
}

export function WorkCreateScreen({
  ctx,
  options,
  error,
  initialCustomerId,
  initialSiteId,
  initialAssetId,
}: {
  ctx: FrigoraOpsContext;
  options: WorkCreateOptions;
  error?: string;
  initialCustomerId?: string;
  initialSiteId?: string;
  initialAssetId?: string;
}) {
  return (
    <PageFrame
      page="Create work order"
      kicker="Work"
      title="Create work order"
      description="Intake uses reported condition — what was reported — not a technical finding."
      ventureId={ctx.ventureId}
      actions={
        <Fit>
          <Link href={`/ventures/${ctx.ventureId}/work`} className="vos-btn-secondary">
            All work
          </Link>
        </Fit>
      }
    >
      <Stack gap="section">
        {error ? (
          <p className="ids-caption text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {!ctx.canWrite ? (
          <p className="ids-caption text-muted">
            Creating work orders requires venture update permission.
          </p>
        ) : options.customers.length === 0 ? (
          <EmptyCopy
            title="No customers available"
            action={
              <Fit>
                <Link
                  href={`/ventures/${ctx.ventureId}/customers`}
                  className="vos-btn-primary"
                >
                  Go to customers
                </Link>
              </Fit>
            }
          >
            Create a customer and site before opening work.
          </EmptyCopy>
        ) : (
          <CreateWorkOrderForm
            workspaceId={ctx.workspaceId}
            ventureId={ctx.ventureId}
            options={options}
            initialCustomerId={initialCustomerId}
            initialSiteId={initialSiteId}
            initialAssetId={initialAssetId}
          />
        )}
      </Stack>
    </PageFrame>
  );
}

export function WorkDetailScreen({
  ctx,
  view,
}: {
  ctx: FrigoraOpsContext;
  view: WorkOrderDetailView;
}) {
  const { workOrder, customer, site, asset, assignee, visits, visitAttendees, visitFacts } =
    view;

  const workBase = `/ventures/${ctx.ventureId}/work/${workOrder.id}`;
  const assignedToMe = workOrder.assignedUserId === ctx.sessionUserId;
  const isOpen = workOrder.status === "open";
  const openVisits = visits.filter((visit) => visit.status === "open");
  const latestOpen = openVisits.length > 0 ? openVisits[openVisits.length - 1] : null;
  const mayExecute = ctx.canWrite && isOpen && assignedToMe;

  return (
    <PageFrame
      page={workOrder.workReference}
      kicker="Work order"
      title={workOrder.workReference}
      description={`${customer?.displayName ?? "Customer"} · ${site?.name ?? "Site"}`}
      meta={workOrder.status}
      ventureId={ctx.ventureId}
      actions={
        <Fit>
          <Link href={`/ventures/${ctx.ventureId}/work`} className="vos-btn-secondary">
            All work
          </Link>
        </Fit>
      }
    >
      <Stack gap="section">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="ids-caption text-muted">Status</dt>
            <dd className="ids-body">{workOrder.status}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Work kind</dt>
            <dd className="ids-body">{workOrder.workKind}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Customer</dt>
            <dd className="ids-body">{customer?.displayName ?? "—"}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Site</dt>
            <dd className="ids-body">{site?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Primary asset</dt>
            <dd className="ids-body">
              {asset ? `${asset.tag}${asset.name ? ` — ${asset.name}` : ""}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Current assignment</dt>
            <dd className="ids-body">
              {assignee
                ? `${assignee.name}${assignee.email ? ` (${assignee.email})` : ""}`
                : "Unassigned"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="ids-caption text-muted">Reported condition</dt>
            <dd className="ids-body whitespace-pre-wrap">
              {workOrder.reportedCondition ?? "—"}
            </dd>
          </div>
        </dl>

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Assignment</h2>
          {workOrder.status === "open" ? (
            <AssignmentControls
              workspaceId={ctx.workspaceId}
              ventureId={ctx.ventureId}
              workOrderId={workOrder.id}
              assignedUserId={workOrder.assignedUserId}
              canWrite={ctx.canWrite}
            />
          ) : (
            <p className="ids-caption text-muted">
              Assignment can only change on open work orders.
            </p>
          )}
        </Stack>

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Field execution</h2>
          {mayExecute && !latestOpen ? (
            <Fit>
              <Link href={`${workBase}/visit`} className="vos-btn-primary w-full sm:w-auto">
                Start visit
              </Link>
            </Fit>
          ) : mayExecute && latestOpen ? (
            <Fit>
              <Link
                href={`${workBase}/visit/${latestOpen.id}`}
                className="vos-btn-primary w-full sm:w-auto"
              >
                Continue visit
              </Link>
            </Fit>
          ) : isOpen && !workOrder.assignedUserId ? (
            <p className="ids-caption text-muted">
              Assign this work order before field execution.
            </p>
          ) : isOpen && workOrder.assignedUserId && !assignedToMe ? (
            <p className="ids-caption text-muted">
              Assigned to {assignee?.name ?? workOrder.assignedUserId}. Field execution is
              for the assignee.
            </p>
          ) : null}
        </Stack>

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Visits</h2>
          {visits.length === 0 ? (
            <EmptyCopy title="No visits recorded yet">
              Start a visit from field execution when this work is assigned to you.
            </EmptyCopy>
          ) : (
            <Stack gap="compact">
              {visitFacts.map((facts) => (
                <article
                  key={facts.visit.id}
                  className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4"
                >
                  <Stack gap="tight">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="ids-body">
                        {facts.visit.status} ·{" "}
                        {visitAttendees[facts.visit.id]?.name ??
                          facts.visit.attendingUserId}
                      </p>
                      <Link
                        href={`${workBase}/visit/${facts.visit.id}`}
                        className="vos-btn-secondary"
                      >
                        View visit
                      </Link>
                    </div>
                    <VisitFactsReadBack facts={facts} />
                  </Stack>
                </article>
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>
    </PageFrame>
  );
}
