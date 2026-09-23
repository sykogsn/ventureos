import Link from "next/link";
import { Stack } from "@/core/layout";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  buildOperationsCalendarHref,
  formatScheduledWindow,
  formatWorkKindLabel,
  shiftUtcDate,
} from "@/modules/frigora/app/engineer-calendar";
import { DispatchControls } from "@/modules/frigora/app/forms/dispatch-controls";
import { hasActiveVisit } from "@/modules/frigora/app/operational-derivations";
import type {
  DispatchBoardItem,
  EngineerCalendarSurface,
  UserDisplay,
} from "@/modules/frigora/app/views";

function DispatchCard({
  ctx,
  item,
  members,
  workBase,
}: {
  ctx: FrigoraOpsContext;
  item: DispatchBoardItem;
  members: UserDisplay[];
  workBase: string;
}) {
  const schedule =
    item.workOrder.scheduledStartAt && item.workOrder.scheduledEndAt
      ? formatScheduledWindow(item.workOrder.scheduledStartAt, item.workOrder.scheduledEndAt)
      : "No service window";

  return (
    <li className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4">
      <Stack gap="tight">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Link
            href={`${workBase}/${item.workOrder.id}`}
            className="ids-body underline-offset-2 hover:underline"
          >
            {item.workOrder.workReference}
          </Link>
          <span className="ids-caption text-muted">{formatWorkKindLabel(item.workOrder.workKind)}</span>
        </div>
        <p className="ids-caption text-muted">
          {item.customer?.displayName ?? "—"} / {item.site?.name ?? "—"}
        </p>
        <p className="ids-caption text-muted">{schedule}</p>
        <p className="ids-caption text-muted">
          {item.assignee?.name ?? "Unassigned"} · {item.responseState.replaceAll("_", " ")}
        </p>
        <details>
          <summary className="ids-caption cursor-pointer text-muted">Dispatch controls</summary>
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
              hasActiveVisit={hasActiveVisit(item.visits)}
            />
          </div>
        </details>
      </Stack>
    </li>
  );
}

export function EngineerCalendarPanel({
  ctx,
  date,
  members,
  calendar,
  unassignedQueue,
}: {
  ctx: FrigoraOpsContext;
  date: string;
  members: UserDisplay[];
  calendar: EngineerCalendarSurface;
  unassignedQueue: DispatchBoardItem[];
}) {
  const workBase = `/ventures/${ctx.ventureId}/work`;
  const previousHref = buildOperationsCalendarHref(ctx.ventureId, {
    date: shiftUtcDate(date, -1),
    engineerId: calendar.engineerId,
  });
  const nextHref = buildOperationsCalendarHref(ctx.ventureId, {
    date: shiftUtcDate(date, 1),
    engineerId: calendar.engineerId,
  });
  const filteredMember = calendar.engineerId
    ? members.find((member) => member.id === calendar.engineerId)
    : null;

  return (
    <Stack gap="section">
      <Stack gap="compact">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="ids-label text-foreground">Engineer calendar</h2>
          <span className="ids-caption text-muted">{date} UTC</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={previousHref} className="vos-btn-secondary">
            Previous day
          </Link>
          <Link href={nextHref} className="vos-btn-secondary">
            Next day
          </Link>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="date" value={date} />
          <label className="ids-caption text-muted" htmlFor="engineer-filter">
            Engineer
          </label>
          <select
            id="engineer-filter"
            name="engineer"
            defaultValue={calendar.engineerId ?? ""}
            className="vos-field"
          >
            <option value="">All engineers</option>
            {calendar.engineerId && !filteredMember ? (
              <option value={calendar.engineerId}>{calendar.engineerId}</option>
            ) : null}
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <button type="submit" className="vos-btn-secondary">
            Filter
          </button>
        </form>
        <p className="ids-caption text-muted">
          Scheduled open work, grouped by the assigned engineer. Placement follows the work
          order service window.
        </p>
        {calendar.groups.length === 0 ? (
          <p className="ids-caption text-muted">
            {calendar.engineerId
              ? "No scheduled work for this engineer on this date."
              : "No scheduled work for this date."}
          </p>
        ) : (
          <div className="grid gap-4">
            {calendar.groups.map((group) => (
              <section key={group.engineerId}>
                <Stack gap="compact">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="ids-body text-foreground">
                      {group.assignee?.name ?? group.engineerId}
                    </h3>
                    <span className="ids-caption text-muted">{group.entries.length}</span>
                  </div>
                  {group.entries.length === 0 ? (
                    <p className="ids-caption text-muted">No scheduled work for this engineer.</p>
                  ) : (
                    <ul className="grid gap-3 lg:grid-cols-2">
                      {group.entries.map((item) => (
                        <DispatchCard
                          key={item.workOrder.id}
                          ctx={ctx}
                          item={item}
                          members={members}
                          workBase={workBase}
                        />
                      ))}
                    </ul>
                  )}
                </Stack>
              </section>
            ))}
          </div>
        )}
      </Stack>

      <Stack gap="compact">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="ids-label text-foreground">Unassigned queue</h2>
          <span className="ids-caption text-muted">{unassignedQueue.length}</span>
        </div>
        <p className="ids-caption text-muted">
          Open work with no assigned engineer. Scheduling a window does not assign it.
        </p>
        {unassignedQueue.length === 0 ? (
          <p className="ids-caption text-muted">No unassigned open work.</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {unassignedQueue.map((item) => (
              <DispatchCard
                key={item.workOrder.id}
                ctx={ctx}
                item={item}
                members={members}
                workBase={workBase}
              />
            ))}
          </ul>
        )}
      </Stack>
    </Stack>
  );
}
