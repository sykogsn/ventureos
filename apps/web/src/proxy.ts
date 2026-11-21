import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth/cookies";
import { applyAuthNavigationHeaders } from "@/lib/auth/navigation-headers";
import { resolveProxyRedirectOrigin } from "@/lib/auth/proxy-redirect-origin";
import { lookupPersistedSession } from "@/lib/auth/session-store";
import { resolveSessionUser } from "@/lib/auth/session-token";
import {
  decideFrigoraDirectAccess,
  frigoraSignedInLoginRedirect,
} from "@/modules/frigora/app/direct-access";
import {
  FRIGORA_DIRECT_ENTRY_PATH,
  isFrigoraPwaPublicPath,
} from "@/modules/frigora/app/pwa/paths";
import { isQuotationDecisionPublicPath } from "@/modules/frigora/quotation-decision-public-path";
import { nowIso } from "@/platform";

const publicPaths = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/forgot-password/sent",
  "/reset-password",
]);

function redirectBase(request: NextRequest): string {
  return resolveProxyRedirectOrigin({
    nodeEnv: process.env.NODE_ENV,
    authUrl: process.env.AUTH_URL,
    requestUrl: request.url,
  });
}

function loginRedirect(request: NextRequest, nextPath?: string) {
  const login = new URL("/login", redirectBase(request));
  login.searchParams.set(
    "next",
    nextPath ?? `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const response = NextResponse.redirect(login);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(WORKSPACE_COOKIE);
  return applyAuthNavigationHeaders(response);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/health/live" || pathname === "/api/health/ready") {
    return applyAuthNavigationHeaders(NextResponse.next());
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token
    ? await resolveSessionUser(token, lookupPersistedSession, nowIso())
    : null;

  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const directAccess = decideFrigoraDirectAccess({
    host,
    forwardedHost,
    pathname,
    authenticated: Boolean(session),
  });
  if (directAccess.kind === "login") {
    return loginRedirect(request, FRIGORA_DIRECT_ENTRY_PATH);
  }
  if (directAccess.kind === "enter") {
    return applyAuthNavigationHeaders(
      NextResponse.redirect(new URL(FRIGORA_DIRECT_ENTRY_PATH, redirectBase(request))),
    );
  }

  if (pathname.startsWith("/auth/google")) {
    return applyAuthNavigationHeaders(NextResponse.next());
  }

  if (pathname === "/invite") {
    return applyAuthNavigationHeaders(NextResponse.next());
  }

  if (isQuotationDecisionPublicPath(pathname)) {
    return applyAuthNavigationHeaders(NextResponse.next());
  }

  if (isFrigoraPwaPublicPath(pathname)) {
    return applyAuthNavigationHeaders(NextResponse.next());
  }

  if (publicPaths.has(pathname)) {
    if (session) {
      const frigoraLogin = frigoraSignedInLoginRedirect({ host, forwardedHost, pathname });
      return applyAuthNavigationHeaders(
        NextResponse.redirect(new URL(frigoraLogin ?? "/dashboard", redirectBase(request))),
      );
    }
    return applyAuthNavigationHeaders(NextResponse.next());
  }

  if (!session) {
    return loginRedirect(request);
  }

  return applyAuthNavigationHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
