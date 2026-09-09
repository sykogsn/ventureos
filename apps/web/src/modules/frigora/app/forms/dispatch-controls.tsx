"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form, Stack } from "@/core/layout";
import {
  assignWorkOrderFormAction,
  clearAssignmentFormAction,
  clearWorkOrderScheduleFormAction,
  scheduleWorkOrderFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";
import type { UserDisplay } from "@/modules/frigora/app/views";

type DispatchControlsProps = {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  assignedUserId: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  members: UserDisplay[];
  canWrite: boolean;
  isOpen: boolean;
  hasActiveVisit: boolean;
};

function HiddenScope({
  workspaceId,
  ventureId,
  workOrderId,
}: Pick<DispatchControlsProps, "workspaceId" | "ventureId" | "workOrderId">) {
  return (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
    </>
  );
}

export function DispatchControls(props: DispatchControlsProps) {
  const [assignState, assignAction, assignPending] = useActionState(
    assignWorkOrderFormAction,
    {} as OfficeFormState,
  );
  const [clearAssignState, clearAssignAction, clearAssignPending] = useActionState(
    clearAssignmentFormAction,
    {} as OfficeFormState,
  );
  const [scheduleState, scheduleAction, schedulePending] = useActionState(
    scheduleWorkOrderFormAction,
    {} as OfficeFormState,
  );
  const [clearScheduleState, clearScheduleAction, clearSchedulePending] = useActionState(
    clearWorkOrderScheduleFormAction,
    {} as OfficeFormState,
  );

  if (!props.isOpen) {
    return <p className="ids-caption text-muted">Dispatch changes require an open work order.</p>;
  }
  if (!props.canWrite) {
    return (
      <p className="ids-caption text-muted">
        Dispatch changes require venture update permission.
      </p>
    );
  }
  if (props.hasActiveVisit) {
    return (
      <p className="ids-caption text-muted">
        Dispatch is locked while a visit is in progress.
      </p>
    );
  }

  const currentMemberPresent = props.members.some(
    (member) => member.id === props.assignedUserId,
  );

  return (
    <Stack gap="compact">
      <Form action={scheduleAction} gap="tight">
        <HiddenScope {...props} />
        <p className="ids-caption text-muted">Planned service window (UTC)</p>
        <label className="ids-caption text-muted" htmlFor={`start-${props.workOrderId}`}>
          Start
        </label>
        <input
          id={`start-${props.workOrderId}`}
          name="scheduledStartAt"
          type="datetime-local"
          defaultValue={props.scheduledStartAt?.slice(0, 16) ?? ""}
          required
          className="vos-field"
        />
        <label className="ids-caption text-muted" htmlFor={`end-${props.workOrderId}`}>
          End
        </label>
        <input
          id={`end-${props.workOrderId}`}
          name="scheduledEndAt"
          type="datetime-local"
          defaultValue={props.scheduledEndAt?.slice(0, 16) ?? ""}
          required
          className="vos-field"
        />
        {scheduleState.error ? (
          <p className="ids-caption text-danger" role="alert">
            {scheduleState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={schedulePending}>
          {schedulePending
            ? "Saving…"
            : props.scheduledStartAt
              ? "Reschedule"
              : "Schedule"}
        </Button>
      </Form>

      {props.scheduledStartAt ? (
        <Form action={clearScheduleAction} gap="tight">
          <HiddenScope {...props} />
          {clearScheduleState.error ? (
            <p className="ids-caption text-danger" role="alert">
              {clearScheduleState.error}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={clearSchedulePending}>
            {clearSchedulePending ? "Clearing…" : "Clear schedule"}
          </Button>
        </Form>
      ) : null}

      <Form action={assignAction} gap="tight">
        <HiddenScope {...props} />
        <label className="ids-caption text-muted" htmlFor={`assignee-${props.workOrderId}`}>
          Assigned workspace member
        </label>
        <select
          key={props.assignedUserId ?? "unassigned"}
          id={`assignee-${props.workOrderId}`}
          name="userId"
          defaultValue={props.assignedUserId ?? ""}
          required
          className="vos-field"
        >
          <option value="" disabled>
            Select member
          </option>
          {props.assignedUserId && !currentMemberPresent ? (
            <option value={props.assignedUserId}>{props.assignedUserId} (no longer present)</option>
          ) : null}
          {props.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}{member.email ? ` · ${member.email}` : ""}
            </option>
          ))}
        </select>
        {assignState.error ? (
          <p className="ids-caption text-danger" role="alert">
            {assignState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={assignPending || props.members.length === 0}>
          {assignPending
            ? "Assigning…"
            : props.assignedUserId
              ? "Reassign"
              : "Assign"}
        </Button>
      </Form>

      {props.assignedUserId ? (
        <Form action={clearAssignAction} gap="tight">
          <HiddenScope {...props} />
          {clearAssignState.error ? (
            <p className="ids-caption text-danger" role="alert">
              {clearAssignState.error}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={clearAssignPending}>
            {clearAssignPending ? "Unassigning…" : "Unassign"}
          </Button>
        </Form>
      ) : null}
    </Stack>
  );
}
