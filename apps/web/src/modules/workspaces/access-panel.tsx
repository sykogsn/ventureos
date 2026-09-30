"use client";

import { useActionState } from "react";
import { Field, Form, Stack } from "@/core/layout";
import {
  roleLabel,
  type WorkspaceAccessView,
  type WorkspaceInvitationView,
  type WorkspaceMemberView,
} from "@/modules/workspaces/access-policy";
import {
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  type AccessActionState,
} from "@/modules/workspaces/access-actions";

function Feedback({
  state,
  id,
}: {
  state: AccessActionState;
  id: string;
}) {
  if (state.error) {
    return (
      <p id={id} role="alert" className="ids-caption text-danger">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p id={id} role="status" className="ids-caption">
        {state.notice}
      </p>
    );
  }
  return null;
}

function MemberRow({
  workspaceId,
  member,
}: {
  workspaceId: string;
  member: WorkspaceMemberView;
}) {
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRoleAction, {});
  const [removeState, removeAction, removePending] = useActionState(removeMemberAction, {});
  const roleErrorId = `member-role-error-${member.userId}`;
  const removeErrorId = `member-remove-error-${member.userId}`;
  const roleFieldId = `member-role-${member.userId}`;

  return (
    <li className="vos-list-item">
      <Stack gap="tight">
        <p className="ids-body text-foreground">{member.name}</p>
        <p className="ids-caption">{member.email}</p>
        <p className="ids-caption">
          Role: {roleLabel(member.role)}. State: {member.state}.
        </p>
        {member.restriction ? (
          <p id={`member-restriction-${member.userId}`} className="ids-caption">
            {member.restriction}
          </p>
        ) : null}
        <Form action={roleAction} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="userId" value={member.userId} />
          <Field>
            Role
            <select
              id={roleFieldId}
              name="role"
              className="vos-field"
              defaultValue={member.role}
              disabled={!member.canChangeRole}
              aria-invalid={roleState.error ? true : undefined}
              aria-describedby={
                [member.restriction ? `member-restriction-${member.userId}` : "", roleState.error || roleState.notice ? roleErrorId : ""]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            >
              {(["owner", "admin", "member"] as const).map((role) => (
                <option key={role} value={role} disabled={!member.selectableRoles.includes(role)}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </Field>
          <Feedback state={roleState} id={roleErrorId} />
          <button
            type="submit"
            className="vos-btn-secondary"
            disabled={!member.canChangeRole || rolePending}
          >
            {rolePending ? "Updating role…" : "Update role"}
          </button>
        </Form>
        <Form action={removeAction} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="userId" value={member.userId} />
          <Feedback state={removeState} id={removeErrorId} />
          <button
            type="submit"
            className="vos-btn-secondary"
            disabled={!member.canRemove || removePending}
            aria-describedby={
              [member.restriction ? `member-restriction-${member.userId}` : "", removeState.error || removeState.notice ? removeErrorId : ""]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            {removePending ? "Removing…" : "Remove access"}
          </button>
        </Form>
      </Stack>
    </li>
  );
}

function InvitationRow({
  workspaceId,
  invitation,
}: {
  workspaceId: string;
  invitation: WorkspaceInvitationView;
}) {
  const [state, action, pending] = useActionState(revokeInvitationAction, {});
  const feedbackId = `invitation-feedback-${invitation.id}`;

  return (
    <li className="vos-list-item">
      <Stack gap="tight">
        <p className="ids-body text-foreground">{invitation.email}</p>
        <p className="ids-caption">Proposed role: {roleLabel(invitation.role)}.</p>
        <p className="ids-caption">
          State: {invitation.state}. Expires <time dateTime={invitation.expiresAt}>{invitation.expiresAt}</time>.
        </p>
        {invitation.restriction ? (
          <p id={`invitation-restriction-${invitation.id}`} className="ids-caption">
            {invitation.restriction}
          </p>
        ) : null}
        <Form action={action} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="invitationId" value={invitation.id} />
          <Feedback state={state} id={feedbackId} />
          <button
            type="submit"
            className="vos-btn-secondary"
            disabled={!invitation.canRevoke || pending}
            aria-describedby={
              [invitation.restriction ? `invitation-restriction-${invitation.id}` : "", state.error || state.notice ? feedbackId : ""]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            {pending ? "Revoking…" : "Revoke invitation"}
          </button>
        </Form>
      </Stack>
    </li>
  );
}

function InviteMemberForm({ access }: { access: WorkspaceAccessView }) {
  const [state, action, pending] = useActionState(inviteMemberAction, {});
  const canInvite = access.inviteRoles.some((choice) => choice.enabled);
  const feedbackId = "invite-member-feedback";
  const defaultRole = access.inviteRoles.find((choice) => choice.enabled)?.role ?? "member";

  return (
    <Form action={action} gap="tight">
      <input type="hidden" name="workspaceId" value={access.workspaceId} />
      <Field>
        Email
        <input
          id="invite-email"
          name="email"
          type="email"
          required={canInvite}
          disabled={!canInvite}
          autoComplete="email"
          className="vos-field"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error || state.notice ? feedbackId : undefined}
        />
      </Field>
      <fieldset className="flex flex-col gap-[var(--ids-foundation-space-2)]" disabled={!canInvite}>
        <legend className="ids-label">Role</legend>
        {access.inviteRoles.map((choice) => (
          <label key={choice.role} className="ids-label flex items-start gap-[var(--ids-foundation-space-2)]" htmlFor={`invite-role-${choice.role}`}>
            <input
              id={`invite-role-${choice.role}`}
              type="radio"
              name="role"
              value={choice.role}
              defaultChecked={choice.role === defaultRole}
              disabled={!choice.enabled}
              aria-describedby={choice.reason ? `invite-role-reason-${choice.role}` : undefined}
            />
            <span>
              {roleLabel(choice.role)}
              {choice.reason ? (
                <span id={`invite-role-reason-${choice.role}`} className="ids-caption block">
                  {choice.reason}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
      <Feedback state={state} id={feedbackId} />
      <button type="submit" className="vos-btn-primary" disabled={!canInvite || pending}>
        {pending ? "Sending invitation…" : "Invite member"}
      </button>
    </Form>
  );
}

export function WorkspaceAccessPanel({ access }: { access: WorkspaceAccessView }) {
  return (
    <Stack gap="section">
      {access.notice ? <p className="ids-body text-foreground">{access.notice}</p> : null}

      <section aria-labelledby="workspace-members-heading">
        <h3 id="workspace-members-heading" className="ids-kicker">
          Workspace members
        </h3>
        {access.members.length === 0 ? (
          <p className="ids-caption">
            {access.authorised ? "No members are listed for this workspace." : "Member details are visible to owners and admins."}
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--ids-foundation-space-4)]">
            {access.members.map((member) => (
              <MemberRow key={member.userId} workspaceId={access.workspaceId} member={member} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pending-invitations-heading">
        <h3 id="pending-invitations-heading" className="ids-kicker">
          Pending invitations
        </h3>
        {access.invitations.length === 0 ? (
          <p className="ids-caption">
            {access.authorised ? "No pending invitations." : "Invitations are visible to owners and admins."}
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--ids-foundation-space-4)]">
            {access.invitations.map((invitation) => (
              <InvitationRow key={invitation.id} workspaceId={access.workspaceId} invitation={invitation} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="invite-member-heading">
        <h3 id="invite-member-heading" className="ids-kicker">
          Invite member
        </h3>
        <InviteMemberForm access={access} />
      </section>
    </Stack>
  );
}
