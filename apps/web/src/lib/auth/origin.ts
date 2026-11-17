import { headers } from "next/headers";
import { resolvePublicAppOrigin } from "@/platform/runtime/production-process-contract";

export async function publicAppOrigin() {
  if (process.env.NODE_ENV === "production" || process.env.AUTH_URL) {
    return resolvePublicAppOrigin({
      nodeEnv: process.env.NODE_ENV,
      authUrl: process.env.AUTH_URL,
      forwardedHost: null,
      forwardedProto: null,
      host: null,
    });
  }

  const headerList = await headers();
  return resolvePublicAppOrigin({
    nodeEnv: process.env.NODE_ENV,
    authUrl: process.env.AUTH_URL,
    forwardedHost: headerList.get("x-forwarded-host"),
    forwardedProto: headerList.get("x-forwarded-proto"),
    host: headerList.get("host"),
  });
}
