import { NextResponse, type NextRequest } from "next/server";
import type { VentureId, WorkspaceId } from "@/contracts";
import { getActiveWorkspaceId, getSession } from "@/lib/auth/session";
import { getPlatform } from "@/platform/kernel";
import { StoredObjectError } from "@/platform/storage/errors";
import { toStoredObjectRef } from "@/platform/storage/service";

export const runtime = "nodejs";

function mapStoredObjectError(error: unknown) {
  if (error instanceof StoredObjectError) {
    if (error.code === "VALIDATION") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Could not store object." }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const activeWorkspaceId = await getActiveWorkspaceId();
  if (!activeWorkspaceId) {
    return NextResponse.json({ error: "Active workspace is required." }, { status: 403 });
  }

  const formData = await request.formData();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const ventureRaw = String(formData.get("ventureId") ?? "").trim();
  const ventureId = ventureRaw.length > 0 ? ventureRaw : undefined;
  const file = formData.get("file");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }

  try {
    const body = new Uint8Array(await file.arrayBuffer());
    const metadata = await getPlatform().storedObjects.store({
      scope: {
        workspaceId: workspaceId as WorkspaceId,
        ventureId: ventureId as VentureId | undefined,
      },
      actorUserId: session.id,
      activeWorkspaceId: activeWorkspaceId as WorkspaceId,
      body,
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
    });

    return NextResponse.json(toStoredObjectRef(metadata), { status: 201 });
  } catch (error) {
    return mapStoredObjectError(error);
  }
}
