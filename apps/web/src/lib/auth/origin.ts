import { headers } from "next/headers";

export async function publicAppOrigin() {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL.replace(/\/$/, "");
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}
