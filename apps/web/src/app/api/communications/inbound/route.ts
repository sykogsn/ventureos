import { NextResponse } from "next/server";
import { readBoundedRequestBody } from "@/platform/communications/body";
import { readCommunicationsConfig } from "@/platform/communications/config";
import { processInboundWebhook, rejectUnreadInboundBody } from "@/platform/communications/inbound";
import { MAX_WEBHOOK_BODY_BYTES } from "@/platform/communications/policy";
import { createResendEmailProvider } from "@/platform/communications/resend";
import { createCommunicationsStore } from "@/platform/communications/store";
import { getPlatform } from "@/platform/kernel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const audit = getPlatform().audit;
  const read = await readBoundedRequestBody(request, MAX_WEBHOOK_BODY_BYTES);
  if (!read.ok) {
    const rejected = await rejectUnreadInboundBody(
      audit,
      read.reason === "too_large" ? "payload_too_large" : "payload_unreadable",
    );
    return NextResponse.json(rejected.body, { status: rejected.status });
  }

  const config = readCommunicationsConfig();
  const result = await processInboundWebhook({
    rawBody: read.bytes,
    headers: {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    config,
    provider: config ? createResendEmailProvider({ apiKey: config.apiKey }) : null,
    store: createCommunicationsStore(),
    audit,
  });
  return NextResponse.json(result.body, { status: result.status });
}
