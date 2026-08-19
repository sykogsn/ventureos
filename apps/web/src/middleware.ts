import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth/cookies";
import { lookupPersistedSession } from "@/lib/auth/session-store";
import { resolveSessionUser } from "@/lib/auth/session-token";
import { nowIso } from "@/platform";

export const runtime = "nodejs";

const publicPaths = new Set(["/login", "/signup"]);

function loginRedirect(request: NextRequest) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  const response = NextResponse.redirect(login);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(WORKSPACE_COOKIE);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token
    ? await resolveSessionUser(token, lookupPersistedSession, nowIso())
    : null;

  if (publicPaths.has(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return loginRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
