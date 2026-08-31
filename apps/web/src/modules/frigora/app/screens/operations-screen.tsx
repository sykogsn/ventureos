import Link from "next/link";
import { PageFrame } from "@/core";
import { Fit, Stack } from "@/core/layout";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  ATTENTION_SIGNAL_LABELS,
  type OperationsOverviewView,
} from "@/modules/frigora/app/views";

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
  const { counts, attention, recentActivity } = view;

  return (
    <PageFrame
      page="Operations"
      kicker="Frigora operations"
      title="Operations"
      description="Current operational state from certified work and visit records."
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
          <h2 className="ids-label text-foreground">Operational summary</h2>
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

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Operational attention</h2>
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
