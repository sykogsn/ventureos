"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/button";
import { Form } from "@/core/layout";
import type { EngineerUnavailability } from "@/modules/frigora/availability";
import type { UserDisplay } from "../views";
import { unavailabilityFormAction, type OfficeFormState } from "../mutation-actions";

export function UnavailabilityForm({ workspaceId, ventureId, members, period }: {
  workspaceId: string; ventureId: string; members: UserDisplay[]; period?: EngineerUnavailability;
}) {
  const [state, action, pending] = useActionState(unavailabilityFormAction, {} as OfficeFormState);
  const key = period?.id ?? "new-unavailability";
  return <Form action={action} gap="tight">
    <input type="hidden" name="workspaceId" value={workspaceId} />
    <input type="hidden" name="ventureId" value={ventureId} />
    <input type="hidden" name="id" value={period?.id ?? ""} />
    <input type="hidden" name="expectedUpdatedAt" value={period?.updatedAt ?? ""} />
    <label className="ids-caption" htmlFor={`${key}-engineer`}>Engineer</label>
    <select id={`${key}-engineer`} name="userId" defaultValue={state.values?.userId ?? period?.userId ?? ""} required className="vos-field">
      <option value="" disabled>Select member</option>
      {period && !members.some((member) => member.id === period.userId) ? <option value={period.userId}>{period.userId}</option> : null}
      {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
    </select>
    <label className="ids-caption" htmlFor={`${key}-start`}>Unavailable start (UTC)</label>
    <input id={`${key}-start`} name="unavailableStartAt" type="datetime-local" required className="vos-field"
      defaultValue={state.values?.unavailableStartAt ?? period?.unavailableStartAt.slice(0, 16) ?? ""} />
    <label className="ids-caption" htmlFor={`${key}-end`}>Unavailable end (UTC)</label>
    <input id={`${key}-end`} name="unavailableEndAt" type="datetime-local" required className="vos-field"
      defaultValue={state.values?.unavailableEndAt ?? period?.unavailableEndAt.slice(0, 16) ?? ""} />
    {state.error ? <p role="alert" className="ids-caption text-danger">{state.error}</p> : null}
    {state.message ? <p role="status" className="ids-caption">{state.message}</p> : null}
    {state.conflicts?.length ? <div role="status" className="ids-caption">
      <p>Existing bookings affected. Review these work orders; their dispatch state has not changed.</p>
      <ul>{state.conflicts.map((work) => <li key={work.id}>{work.workReference}: {work.scheduledStartAt} – {work.scheduledEndAt}</li>)}</ul>
    </div> : null}
    <Button type="submit" disabled={pending || !members.length}>{pending ? "Saving…" : period ? "Update unavailable period" : "Add unavailable period"}</Button>
    {period ? <Button type="submit" name="operation" value="delete" formNoValidate variant="secondary" disabled={pending}>Remove unavailable period</Button> : null}
  </Form>;
}
