import { assessReadiness } from "@/platform/runtime/production-process-contract";

export const dynamic = "force-dynamic";

export function GET() {
  const result = assessReadiness();
  return Response.json(result.body, {
    status: result.httpStatus,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
