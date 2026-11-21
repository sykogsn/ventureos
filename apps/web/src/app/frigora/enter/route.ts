import { NextResponse } from "next/server";
import type { UserId } from "@/contracts";
import { WORKSPACE_COOKIE } from "@/lib/auth/cookies";
import { publicAppOrigin } from "@/lib/auth/origin";
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

export async function GET() {
  // Render may expose its internal localhost address through request.url.
  // Always derive outward-facing redirects from the configured public origin.
  const publicOrigin = await publicAppOrigin();
  const session = await getSession();
  if (!session) {
    return applyAuthNavigationHeaders(
      NextResponse.redirect(new URL(frigoraDirectLoginPath(), publicOrigin)),
    );
  }

  const ventures = await listAuthorisedFrigoraVentures(session.id as UserId);
  const choice = chooseFrigoraDirectAccess(ventures);
  if (choice.mode === "choose") {
    return applyAuthNavigationHeaders(
      NextResponse.redirect(new URL("/frigora", publicOrigin)),
    );
  }

  const response = NextResponse.redirect(new URL(choice.path, publicOrigin));
  response.cookies.set(WORKSPACE_COOKIE, choice.workspaceId, workspaceCookieOptions());
  return applyAuthNavigationHeaders(response);
}
