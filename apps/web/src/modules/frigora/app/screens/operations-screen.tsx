import Link from "next/link";
import { PageFrame } from "@/core";
import { Fit, Stack } from "@/core/layout";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import { DispatchControls } from "@/modules/frigora/app/forms/dispatch-controls";
import {
  DISPATCH_BUCKET_LABELS,
  type DispatchBoardBucket,
} from "@/modules/frigora/app/operational-derivations";
import {
  ATTENTION_SIGNAL_LABELS,
  type OperationsOverviewView,
} from "@/modules/frigora/app/views";

const BOARD_ORDER: DispatchBoardBucket[] = [
  "unscheduled",
  "scheduled_unassigned",
  "awaiting_response",
  "accepted",
  "declined",
  "active",
  "completed",
];

function MetricCard({
  label,
  value,
  caption,
  href,
}: {
  label: string;
  value: number;
  caption?: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4">
      <p className="ids-caption text-muted">{label}</p>
      <p className="ids-label text-foreground mt-1">{value}</p>
      {caption ? <p className="ids-caption text-muted mt-1">{caption}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:border-[var(--ids-foundation-stroke-strong)]">
        {content}
      </Link>
    );
  }

  return content;
}

export function OperationsScreen({
  ctx,
  view,
  error,
}: {
  ctx: FrigoraOpsContext;
  view: OperationsOverviewView;
  error?: string;
}) {
  const workBase = `/ventures/${ctx.ventureId}/work`;
  const { counts, attention, recentActivity, range, members, board } = view;

  return (
    <PageFrame
      page="Service Desk"
      kicker="Frigora operations"
      title="Service Desk"
      description="Plan, assign and coordinate existing work without changing its execution lifecycle."
      ventureId={ctx.ventureId}
      actions={
        <Fit>
          <Link href={workBase} className="vos-btn-secondary">
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

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Day board</h2>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="ids-caption text-muted" htmlFor="service-date">
              Service date (UTC)
            </label>
            <input
              id="service-date"
              name="date"
              type="date"
              defaultValue={range.date}
              className="vos-field"
            />
            <button type="submit" className="vos-btn-secondary">
              View date
            </button>
          </form>
          <p className="ids-caption text-muted">
            Scheduled range: {range.start} to {range.end}. Active visits and unscheduled
            open work remain visible.
          </p>
        </Stack>

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Dispatch summary</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Open work"
              value={counts.openWork}
              href={`${workBase}?status=open`}
            />
            <MetricCard
              label="Assigned open"
              value={counts.assignedOpen}
              href={`${workBase}?status=open&assignment=assigned`}
            />
            <MetricCard
              label="Unassigned open"
              value={counts.unassignedOpen}
              href={`${workBase}?status=open&assignment=unassigned`}
            />
            <MetricCard
              label="Active visits"
              value={counts.activeVisits}
              caption="Open visits on open work"
            />
            <MetricCard
              label="Visited / still open"
              value={counts.visitedStillOpen}
              href={`${workBase}?status=open`}
            />
          </div>
          {counts.openWork === 0 ? (
            <p className="ids-caption text-muted">There&apos;s no open work.</p>
          ) : null}
        </Stack>

        <Stack gap="section">
          {BOARD_ORDER.map((bucket) => (
            <section key={bucket}>
              <Stack gap="compact">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="ids-label text-foreground">
                    {DISPATCH_BUCKET_LABELS[bucket]}
                  </h2>
                  <span className="ids-caption text-muted">{board[bucket].length}</span>
                </div>
                {board[bucket].length === 0 ? (
                  <p className="ids-caption text-muted">No work in this category.</p>
                ) : (
                  <ul className="grid gap-3 lg:grid-cols-2">
                    {board[bucket].map((item) => (
                      <li
                        key={item.workOrder.id}
                        className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4"
                      >
                        <Stack gap="tight">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <Link
                              href={`${workBase}/${item.workOrder.id}`}
                              className="ids-body underline-offset-2 hover:underline"
                            >
                              {item.workOrder.workReference}
                            </Link>
                            <span className="ids-caption text-muted">
                              {item.assignee?.name ?? "Unassigned"}
                            </span>
                          </div>
                          <p className="ids-caption text-muted">
                            {item.customer?.displayName ?? "—"} / {item.site?.name ?? "—"}
                          </p>
                          <p className="ids-caption text-muted">
                            {item.workOrder.scheduledStartAt && item.workOrder.scheduledEndAt
                              ? `${item.workOrder.scheduledStartAt} → ${item.workOrder.scheduledEndAt}`
                              : "No service window"}
                          </p>
                          <p className="ids-caption text-muted">
                            Response: {item.responseState.replaceAll("_", " ")}
                          </p>
                          {item.workOrder.assignmentDeclineReason ? (
                            <p className="ids-caption text-danger">
                              Decline reason: {item.workOrder.assignmentDeclineReason}
                            </p>
                          ) : null}
                          <details>
                            <summary className="ids-caption cursor-pointer text-muted">
                              Dispatch controls
                            </summary>
                            <div className="mt-3">
                              <DispatchControls
                                workspaceId={ctx.workspaceId}
                                ventureId={ctx.ventureId}
                                workOrderId={item.workOrder.id}
                                updatedAt={item.workOrder.updatedAt}
                                assignedUserId={item.workOrder.assignedUserId}
                                scheduledStartAt={item.workOrder.scheduledStartAt}
                                scheduledEndAt={item.workOrder.scheduledEndAt}
                                members={members}
                                canWrite={ctx.canWrite}
                                isOpen={item.workOrder.status === "open"}
                                hasActiveVisit={item.visits.some(
                                  (visit) => visit.status === "open",
                                )}
                              />
                            </div>
                          </details>
                        </Stack>
                      </li>
                    ))}
                  </ul>
                )}
              </Stack>
            </section>
          ))}
        </Stack>

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Service Desk attention</h2>
          {attention.length === 0 ? (
            <p className="ids-caption text-muted">No operational attention signals.</p>
          ) : (
            <ul className="divide-y divide-[var(--ids-foundation-stroke-subtle)]">
              {attention.map((item) => (
                <li key={item.workOrder.id} className="py-3">
                  <Stack gap="tight">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`${workBase}/${item.workOrder.id}`}
                        className="ids-body underline-offset-2 hover:underline"
                      >
                        {item.workOrder.workReference}
                      </Link>
                      <span className="ids-caption text-muted">
                        {item.assignee?.name ?? "Unassigned"}
                      </span>
                    </div>
                    <p className="ids-caption text-muted">
                      {item.customer?.displayName ?? "—"} / {item.site?.name ?? "—"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.signals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-[var(--ids-foundation-radius-sm)] border border-[var(--ids-foundation-stroke-subtle)] px-2 py-0.5 ids-caption text-muted"
                        >
                          {ATTENTION_SIGNAL_LABELS[signal]}
                        </span>
                      ))}
                    </div>
                  </Stack>
                </li>
              ))}
            </ul>
          )}
        </Stack>

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Recent activity</h2>
          {recentActivity.length === 0 ? (
            <p className="ids-caption text-muted">No operational activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--ids-foundation-stroke-subtle)]">
              {recentActivity.map((event) => (
                <li key={`${event.kind}-${event.sourceId}`} className="py-3">
                  <Stack gap="tight">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`${workBase}/${event.workOrderId}`}
                        className="ids-body underline-offset-2 hover:underline"
                      >
                        {event.workOrderReference}
                      </Link>
                      <span className="ids-caption text-muted">{event.occurredAt}</span>
                    </div>
                    <p className="ids-body">{event.label}</p>
                    {event.detail ? (
                      <p className="ids-caption text-muted">{event.detail}</p>
                    ) : null}
                  </Stack>
                </li>
              ))}
            </ul>
          )}
        </Stack>
      </Stack>
    </PageFrame>
  );
}
