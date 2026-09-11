import type { Metadata } from "next";
import { LoginScreen } from "@/modules/auth";
import { loginMessages } from "@/modules/auth/messages";

export const metadata: Metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    reset?: string | string[];
    signedOut?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const error = typeof params.error === "string" ? params.error : "";
  const reset = params.reset === "1";
  const signedOut = params.signedOut === "1";
  const message = signedOut
    ? loginMessages.signed_out
    : reset
      ? loginMessages.reset
      : error
        ? loginMessages[error]
        : undefined;

  return <LoginScreen next={next} message={message} signedOut={signedOut} />;
}
