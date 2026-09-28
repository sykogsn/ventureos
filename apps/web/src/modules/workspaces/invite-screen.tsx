import type { SessionUser } from "@/lib/auth/session";
import {
  AuthHeading,
  AuthMutedLine,
  AuthNotice,
  QuietLink,
  TextLink,
} from "@/modules/auth/presentation";
import type { InvitationPreview } from "@/modules/workspaces/access";
import { roleLabel } from "@/modules/workspaces/access-policy";
import { AcceptInvitationForm } from "@/modules/workspaces/accept-invitation-form";

export function InviteScreen({
  token,
  session,
  preview,
}: {
  token: string;
  session: SessionUser | null;
  preview: InvitationPreview | null;
}) {
  const signupHref = token ? `/signup?token=${encodeURIComponent(token)}` : "/signup";
  const loginHref = token
    ? `/login?next=${encodeURIComponent(`/invite?token=${token}`)}`
    : "/login";

  if (!token || !preview) {
    return (
      <section aria-labelledby="invite-title" className="space-y-6">
        <AuthHeading
          id="invite-title"
          title="Workspace invitation"
          description="This invitation is invalid or has expired."
        />
        <TextLink href="/login">Back to sign in</TextLink>
      </section>
    );
  }

  const pending = preview.state === "pending";
  const description = pending
    ? `Join ${preview.workspaceName} as ${roleLabel(preview.role)}.`
    : preview.state === "revoked"
      ? "This invitation has been revoked."
      : preview.state === "accepted"
        ? "This invitation has already been used."
        : "This invitation has expired.";
  const emailMatches = session?.email.trim().toLowerCase() === preview.email;

  return (
    <section aria-labelledby="invite-title" className="space-y-6">
      <AuthHeading id="invite-title" title="Workspace invitation" description={description} />
      <p className="ids-body text-foreground">
        Invited email: {preview.email}. Proposed role: {roleLabel(preview.role)}. State:{" "}
        {preview.state}.
      </p>
      {pending && session && emailMatches ? <AcceptInvitationForm token={token} /> : null}
      {pending && session && !emailMatches ? (
        <>
          <AuthNotice
            tone="warning"
            title="This invitation was sent to a different email."
            assertive
          />
          <button type="button" className="vos-btn-primary" disabled aria-describedby="invite-email-mismatch">
            Accept invitation
          </button>
          <p id="invite-email-mismatch" className="ids-caption">
            Sign in as {preview.email} to accept this invitation.
          </p>
        </>
      ) : null}
      {pending && !session ? (
        <>
          <AuthMutedLine>Sign in if you already have an account, or create one with the invited email.</AuthMutedLine>
          <QuietLink href={loginHref}>Sign in</QuietLink>
          <TextLink href={signupHref}>Create account</TextLink>
        </>
      ) : null}
      {!pending ? <TextLink href="/login">Back to sign in</TextLink> : null}
    </section>
  );
}
