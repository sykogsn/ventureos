"use client";

import { useActionState, useState } from "react";
import { Button } from "@repo/ui/button";
import { Form, Stack } from "@/core/layout";
import {
  assignWorkOrderFormAction,
  clearAssignmentFormAction,
  clearWorkOrderScheduleFormAction,
  scheduleWorkOrderFormAction,
  setWorkOrderPriorityFormAction,
  type OfficeFormState,
} from "@/modules/frigora/app/mutation-actions";
import type { UserDisplay } from "@/modules/frigora/app/views";

const WORK_ORDER_PRIORITY_OPTIONS = [
  ["normal", "Normal"],
  ["high", "High"],
  ["urgent", "Urgent"],
] as const;

type WorkOrderPriorityValue = (typeof WORK_ORDER_PRIORITY_OPTIONS)[number][0];

function priorityLabel(priority: WorkOrderPriorityValue) {
  return WORK_ORDER_PRIORITY_OPTIONS.find(([value]) => value === priority)?.[1] ?? "Normal";
}

type DispatchControlsProps = {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  updatedAt: string;
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
  updatedAt,
}: Pick<
  DispatchControlsProps,
  "workspaceId" | "ventureId" | "workOrderId" | "updatedAt"
>) {
  return (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="ventureId" value={ventureId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />
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

      <DoubleBookingConfirmation state={scheduleState} action={scheduleAction} pending={schedulePending} scope={props} />

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

      <DoubleBookingConfirmation state={assignState} action={assignAction} pending={assignPending} scope={props} />

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

function DoubleBookingConfirmation({ state, action, pending, scope }: {
  state: OfficeFormState; action: (data: FormData) => void; pending: boolean; scope: DispatchControlsProps;
}) {
  const [dismissed, setDismissed] = useState<OfficeFormState | null>(null);
  if (state.code !== "double_booking" || state === dismissed || !state.values) return null;
  return <Form action={action} gap="tight">
    <HiddenScope {...scope} updatedAt={state.values.expectedUpdatedAt ?? ""} />
    {Object.entries(state.values).filter(([key]) => key !== "expectedUpdatedAt").map(([key, value]) =>
      <input key={key} type="hidden" name={key} value={value} />)}
    <p className="ids-caption">Confirm the previously submitted booking:
      {state.values.userId ? ` ${scope.members.find((member) => member.id === state.values?.userId)?.name ?? state.values.userId}`
        : ` ${state.values.scheduledStartAt} – ${state.values.scheduledEndAt} UTC`}
    </p>
    <ul className="ids-caption">{state.conflicts?.map((conflict) =>
      <li key={conflict.id}>{conflict.workReference}: {conflict.scheduledStartAt} – {conflict.scheduledEndAt}</li>)}</ul>
    <Button type="submit" name="confirmDoubleBooking" value="true" disabled={pending}>Confirm double-booking</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={() => setDismissed(state)}>Cancel</Button>
  </Form>;
}

export function PriorityLabel({ priority }: { priority: WorkOrderPriorityValue }) {
  const tone =
    priority === "urgent" ? "text-danger" : priority === "high" ? "text-foreground" : "text-muted";
  return (
    <span className={`ids-caption font-medium ${tone}`}>
      {priorityLabel(priority)}
    </span>
  );
}

export function PriorityControl({
  workspaceId,
  ventureId,
  workOrderId,
  updatedAt,
  priority,
  canWrite,
  isOpen,
  hasActiveVisit = false,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  updatedAt: string;
  priority: WorkOrderPriorityValue;
  canWrite: boolean;
  isOpen: boolean;
  hasActiveVisit?: boolean;
}) {
  const [state, action, pending] = useActionState(setWorkOrderPriorityFormAction, {} as OfficeFormState);
  const labelId = `priority-${workOrderId}`;

  if (!isOpen || !canWrite || hasActiveVisit) {
    return (
      <p className="ids-caption text-foreground">
        Priority <PriorityLabel priority={priority} />
        {hasActiveVisit ? ". Dispatch is locked while a visit is in progress." : ""}
      </p>
    );
  }

  return (
    <Form action={action} gap="tight">
      <HiddenScope workspaceId={workspaceId} ventureId={ventureId} workOrderId={workOrderId} updatedAt={updatedAt} />
      <label className="ids-caption text-muted" htmlFor={labelId}>
        Priority
      </label>
      <select
        id={labelId}
        name="priority"
        key={priority}
        defaultValue={priority}
        className="vos-field min-h-11"
      >
        {WORK_ORDER_PRIORITY_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {state.error ? (
        <p className="ids-caption text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="ids-caption text-muted" role="status">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving priority…" : "Save priority"}
      </Button>
    </Form>
  );
}
