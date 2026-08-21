import type { Metadata } from "next";
import { LoginScreen } from "@/modules/auth";
import { loginMessages } from "@/modules/auth/messages";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[]; reset?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const error = typeof params.error === "string" ? params.error : "";
  const reset = params.reset === "1";
  const message = reset ? loginMessages.reset : error ? loginMessages[error] : undefined;

  return <LoginScreen next={next} message={message} />;
}
