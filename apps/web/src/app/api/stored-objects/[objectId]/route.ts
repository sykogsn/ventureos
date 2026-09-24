import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import type { StoredObjectId, WorkspaceId } from "@/contracts";
import { getActiveWorkspaceId, getSession } from "@/lib/auth/session";
import { getPlatform } from "@/platform/kernel";
import { StoredObjectError } from "@/platform/storage/errors";
import { sanitizeStoredObjectFilename } from "@/platform/storage/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ objectId: string }>;
};

function dispositionForMime(mimeType: string, filename: string) {
  const safeName = sanitizeStoredObjectFilename(filename);
  const disposition =
    mimeType === "application/pdf" ? "attachment" : "inline";
  return `${disposition}; filename="${safeName.replace(/"/g, "")}"`;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const activeWorkspaceId = await getActiveWorkspaceId();
  if (!activeWorkspaceId) {
    return NextResponse.json({ error: "Active workspace is required." }, { status: 403 });
  }

  const { objectId } = await context.params;

  const opened = await getPlatform().storedObjects.open({
    actorUserId: session.id,
    activeWorkspaceId: activeWorkspaceId as WorkspaceId,
    objectId: objectId as StoredObjectId,
  });

  if (!opened) {
    return NextResponse.json({ error: "Stored object was not found." }, { status: 404 });
  }

  const stream = Readable.from(Buffer.from(opened.body));
  return new NextResponse(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": opened.metadata.mimeType,
      "Content-Length": String(opened.metadata.sizeBytes),
      "Content-Disposition": dispositionForMime(
        opened.metadata.mimeType,
        opened.metadata.originalFilename,
      ),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const activeWorkspaceId = await getActiveWorkspaceId();
  if (!activeWorkspaceId) {
    return NextResponse.json({ error: "Active workspace is required." }, { status: 403 });
  }

  const { objectId } = await context.params;

  try {
    await getPlatform().storedObjects.delete({
      actorUserId: session.id,
      activeWorkspaceId: activeWorkspaceId as WorkspaceId,
      objectId: objectId as StoredObjectId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof StoredObjectError) {
      if (error.code === "NOT_FOUND") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "FORBIDDEN") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Could not delete object." }, { status: 500 });
  }
}
