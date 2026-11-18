import { allowQuotationDecisionAttempt } from "@/modules/frigora/quotation-decision-rate-limit";
import { createFrigoraService } from "@/modules/frigora/service";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export function GET() {
  return json({ state: "invalid" }, 405);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ state: "invalid" }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ state: "invalid" }, 400);
  }
  const record = body as Record<string, unknown>;
  const grantId = typeof record.grantId === "string" ? record.grantId : "";
  const secret = typeof record.secret === "string" ? record.secret : "";
  if (!allowQuotationDecisionAttempt(grantId, secret)) {
    return json({ state: "limited" }, 429);
  }
  const service = createFrigoraService();
  try {
    if (record.action === "review") {
      return json(await service.reviewCustomerQuotation({ grantId, secret }));
    }
    if (record.action === "submit" && (record.decision === "approved" || record.decision === "declined")) {
      const selectedOptionalLineIds = Array.isArray(record.selectedOptionalLineIds)
        ? record.selectedOptionalLineIds.filter((id): id is string => typeof id === "string")
        : [];
      return json(await service.submitCustomerQuotation({
        grantId,
        secret,
        decision: record.decision,
        selectedOptionalLineIds,
      }));
    }
    return json({ state: "invalid" }, 400);
  } catch {
    return json({ state: "unavailable" }, 503);
  }
}
