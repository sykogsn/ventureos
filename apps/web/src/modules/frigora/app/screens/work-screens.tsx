import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Fit, Stack } from "@/core/layout";
import { AssignmentControls } from "@/modules/frigora/app/forms/assignment-controls";
import { CreateWorkOrderForm } from "@/modules/frigora/app/forms/create-work-order-form";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import type {
  WorkCreateOptions,
  WorkOrderDetailView,
  WorkOrderListRow,
} from "@/modules/frigora/app/views";

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
  const { workOrder, customer, site, asset, assignee, visits, visitAttendees } = view;

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
          <h2 className="ids-label text-foreground">Visits</h2>
          {visits.length === 0 ? (
            <EmptyCopy title="No visits recorded yet">
              Field visit recording belongs to F1.2. Existing visits appear here read-only.
            </EmptyCopy>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left">
                <thead>
                  <tr className="ids-caption text-muted">
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Attending</th>
                    <th className="py-2 pr-4 font-medium">Arrived</th>
                    <th className="py-2 pr-4 font-medium">Departed</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit) => (
                    <tr
                      key={visit.id}
                      className="border-t border-[var(--ids-foundation-stroke-subtle)]"
                    >
                      <td className="py-3 pr-4 ids-body">{visit.status}</td>
                      <td className="py-3 pr-4 ids-body">
                        {visitAttendees[visit.id]?.name ?? visit.attendingUserId}
                      </td>
                      <td className="py-3 pr-4 ids-caption text-muted">{visit.arrivedAt}</td>
                      <td className="py-3 pr-4 ids-caption text-muted">
                        {visit.departedAt ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      </Stack>
    </PageFrame>
  );
}
