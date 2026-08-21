"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  authenticateUser,
  issueSession,
  linkGoogleAfterPassword,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
  type UserRecord,
} from "@/modules/auth/service";
import { GOOGLE_LINK_COOKIE } from "@/lib/auth/cookies";
import { publicAppOrigin } from "@/lib/auth/origin";
import { safeInternalPath } from "@/lib/auth/next-path";
import { readGoogleLink } from "@/modules/auth/google-oauth";
import {
  clearSessionCookie,
  setActiveWorkspaceCookie,
  setSessionCookie,
} from "@/lib/auth/session";
import { listWorkspaces } from "@/modules/workspaces/service";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80).optional(),
});

export type AuthActionState = {
  error?: string;
  notice?: string;
};

async function openDesk(user: UserRecord, remember: boolean) {
  const sessionId = await issueSession(user);
  await setSessionCookie(user, sessionId, { remember });
  const workspaces = await listWorkspaces(user.id);
  const first = workspaces[0];
  if (first) {
    await setActiveWorkspaceCookie(first.id);
  }
}

function rememberFrom(formData: FormData) {
  const value = formData.get("remember");
  return value === "1" || value === "on" || value === "true";
}

export async function signupAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });

  if (!parsed.success || !parsed.data.name) {
    return { error: "Enter a name, valid email, and a password of at least 8 characters." };
  }

  try {
    const user = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
    });
    await openDesk(user, true);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create the account.",
    };
  }

  redirect("/dashboard");
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  try {
    const user = await authenticateUser(parsed.data);
    const jar = await cookies();
    const pending = await readGoogleLink(jar.get(GOOGLE_LINK_COOKIE)?.value ?? "");
    if (pending && pending.email === user.email) {
      await linkGoogleAfterPassword({
        userId: user.id,
        email: pending.email,
        subject: pending.subject,
      });
    }
    jar.delete(GOOGLE_LINK_COOKIE);
    await openDesk(user, rememberFrom(formData));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not sign in.",
    };
  }

  redirect(safeInternalPath(formData.get("next")));
}

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.object({ email: z.string().email() }).safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email." };
  }

  try {
    await requestPasswordReset({
      email: parsed.data.email,
      origin: await publicAppOrigin(),
    });
  } catch (error) {
    console.error("[auth] password reset request failed", error);
    return { error: "Could not send a reset email. Try again." };
  }

  redirect("/forgot-password/sent");
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      token: z.string().min(1),
      password: z.string().min(8),
      confirm: z.string().min(8),
    })
    .safeParse({
      token: formData.get("token"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });

  if (!parsed.success) {
    return { error: "Enter a new password of at least 8 characters." };
  }

  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "Passwords do not match." };
  }

  try {
    await resetPasswordWithToken({
      token: parsed.data.token,
      password: parsed.data.password,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not reset the password.",
    };
  }

  redirect("/login?reset=1");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
