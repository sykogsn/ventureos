import { NextResponse } from "next/server";
import { frigoraWebAppManifest } from "@/modules/frigora/app/pwa/web-app-manifest";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(frigoraWebAppManifest(), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
