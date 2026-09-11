import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { expireAuthCookies } from "@/lib/auth/session-cookie";
import { lookupPersistedSession } from "@/lib/auth/session-store";
import { resolveSessionUser } from "@/lib/auth/session-token";
import { nowIso } from "@/platform";

const publicPaths = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/forgot-password/sent",
  "/reset-password",
]);

function withoutStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  return response;
}

function loginRedirect(request: NextRequest) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  const response = NextResponse.redirect(login);
  expireAuthCookies(response.cookies);
  return withoutStore(response);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token
    ? await resolveSessionUser(token, lookupPersistedSession, nowIso())
    : null;

  if (pathname.startsWith("/auth/google")) {
    return withoutStore(NextResponse.next());
  }

  if (publicPaths.has(pathname)) {
    if (session) {
      return withoutStore(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
    return withoutStore(NextResponse.next());
  }

  if (!session) {
    return loginRedirect(request);
  }

  return withoutStore(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
