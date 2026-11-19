import { NextResponse, type NextRequest } from "next/server";
import type { UserId } from "@/contracts";
import { WORKSPACE_COOKIE } from "@/lib/auth/cookies";
import { applyAuthNavigationHeaders } from "@/lib/auth/navigation-headers";
import { getSession } from "@/lib/auth/session";
import { workspaceCookieOptions } from "@/lib/auth/session-cookie";
import {
  chooseFrigoraDirectAccess,
  frigoraDirectLoginPath,
} from "@/modules/frigora/app/direct-access";
import { listAuthorisedFrigoraVentures } from "@/modules/frigora/app/direct-access-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return applyAuthNavigationHeaders(
      NextResponse.redirect(new URL(frigoraDirectLoginPath(), request.url)),
    );
  }

  const ventures = await listAuthorisedFrigoraVentures(session.id as UserId);
  const choice = chooseFrigoraDirectAccess(ventures);
  if (choice.mode === "choose") {
    return applyAuthNavigationHeaders(
      NextResponse.redirect(new URL("/frigora", request.url)),
    );
  }

  const response = NextResponse.redirect(new URL(choice.path, request.url));
  response.cookies.set(WORKSPACE_COOKIE, choice.workspaceId, workspaceCookieOptions());
  return applyAuthNavigationHeaders(response);
}
