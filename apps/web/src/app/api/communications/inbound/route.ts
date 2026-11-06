import { NextResponse } from "next/server";
import { readCommunicationsConfig } from "@/platform/communications/config";
import { processInboundWebhook } from "@/platform/communications/inbound";
import { createResendEmailProvider } from "@/platform/communications/resend";
import { createCommunicationsStore } from "@/platform/communications/store";
import { getPlatform } from "@/platform/kernel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const config = readCommunicationsConfig();
  const result = await processInboundWebhook({
    rawBody,
    headers: {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    config,
    provider: config ? createResendEmailProvider({ apiKey: config.apiKey }) : null,
    store: createCommunicationsStore(),
    audit: getPlatform().audit,
  });
  return NextResponse.json(result.body, { status: result.status });
}
