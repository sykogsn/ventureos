import { type NextRequest, NextResponse } from "next/server";
import { GOOGLE_LINK_COOKIE, OAUTH_COOKIE } from "@/lib/auth/cookies";
import { sessionCookieOptions } from "@/lib/auth/session-cookie";
import { safeInternalPath } from "@/lib/auth/next-path";
import {
  exchangeGoogleCode,
  readGoogleProfile,
  readOAuthState,
  signGoogleLink,
} from "@/modules/auth/google-oauth";
import { completeGoogleSignIn, issueSession } from "@/modules/auth/service";
import { attachSessionCookies } from "@/lib/auth/session";
import { listWorkspaces } from "@/modules/workspaces/service";

export const runtime = "nodejs";

function loginRedirect(origin: string, code: string) {
  const target = new URL("/login", origin);
  target.searchParams.set("error", code);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = process.env.AUTH_URL?.replace(/\/$/, "") || url.origin;
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError === "access_denied") {
    const denied = loginRedirect(origin, "google_denied");
    denied.cookies.delete(OAUTH_COOKIE);
    return denied;
  }

  if (oauthError || !code || !returnedState) {
    const failed = loginRedirect(origin, "google_failed");
    failed.cookies.delete(OAUTH_COOKIE);
    return failed;
  }

  const oauth = await readOAuthState(request.cookies.get(OAUTH_COOKIE)?.value ?? "");
  if (!oauth || oauth.state !== returnedState) {
    const failed = loginRedirect(origin, "google_failed");
    failed.cookies.delete(OAUTH_COOKIE);
    return failed;
  }

  try {
    const redirectUri = `${origin}/auth/google/callback`;
    const idToken = await exchangeGoogleCode({
      code,
      redirectUri,
      verifier: oauth.verifier,
    });
    const profile = await readGoogleProfile(idToken, oauth.nonce);
    const result = await completeGoogleSignIn(profile);

    if (result.status === "link-after-password") {
      const response = loginRedirect(origin, "google_link");
      response.cookies.delete(OAUTH_COOKIE);
      response.cookies.set(
        GOOGLE_LINK_COOKIE,
        await signGoogleLink({
          subject: result.subject,
          email: result.email,
          name: result.name,
        }),
        { ...sessionCookieOptions(false), maxAge: 60 * 10 },
      );
      return response;
    }

    const sessionId = await issueSession(result.user);
    const workspaces = await listWorkspaces(result.user.id);
    const response = NextResponse.redirect(new URL(safeInternalPath(oauth.next), origin));
    await attachSessionCookies(
      response,
      result.user,
      sessionId,
      oauth.remember,
      workspaces[0]?.id,
    );
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code =
      message.includes("verify")
        ? "google_unverified"
        : message.includes("already")
          ? "google_in_use"
          : "google_failed";
    const failed = loginRedirect(origin, code);
    failed.cookies.delete(OAUTH_COOKIE);
    return failed;
  }
}
