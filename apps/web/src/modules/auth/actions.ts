"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticateUser, issueSession, registerUser } from "@/modules/auth/service";
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
};

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
    const sessionId = await issueSession(user);
    await setSessionCookie(user, sessionId);
    const workspaces = await listWorkspaces(user.id);
    const first = workspaces[0];
    if (first) {
      await setActiveWorkspaceCookie(first.id);
    }
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
    const sessionId = await issueSession(user);
    await setSessionCookie(user, sessionId);
    const workspaces = await listWorkspaces(user.id);
    const first = workspaces[0];
    if (first) {
      await setActiveWorkspaceCookie(first.id);
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not sign in.",
    };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
