import { type NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIE } from "@/lib/auth/cookies";
import { sessionCookieOptions } from "@/lib/auth/session-cookie";
import { safeInternalPath } from "@/lib/auth/next-path";
import {
  createOAuthStateValue,
  createPkcePair,
  googleAuthorizationUrl,
  googleOAuthConfigured,
  signOAuthState,
} from "@/modules/auth/google-oauth";

export const runtime = "nodejs";

function oauthCookieOptions() {
  return {
    ...sessionCookieOptions(false),
    maxAge: 60 * 10,
  };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = process.env.AUTH_URL?.replace(/\/$/, "") || url.origin;
  const next = safeInternalPath(url.searchParams.get("next"));
  const remember = url.searchParams.get("remember") === "1";

  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_config", origin));
  }

  const { verifier, challenge } = createPkcePair();
  const state = createOAuthStateValue();
  const nonce = createOAuthStateValue();
  const redirectUri = `${origin}/auth/google/callback`;
  const signed = await signOAuthState({ state, nonce, verifier, next, remember });
  const authorize = googleAuthorizationUrl({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    redirectUri,
    state,
    nonce,
    challenge,
  });

  const response = NextResponse.redirect(authorize);
  response.cookies.set(OAUTH_COOKIE, signed, oauthCookieOptions());
  return response;
}
