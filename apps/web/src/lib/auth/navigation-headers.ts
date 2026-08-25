import type { NextResponse } from "next/server";

export const AUTH_NAVIGATION_CACHE_CONTROL =
  "private, no-store, max-age=0, must-revalidate";

export function applyAuthNavigationHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", AUTH_NAVIGATION_CACHE_CONTROL);
  return response;
}
