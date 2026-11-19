import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/modules/auth";
import { loginMessages } from "@/modules/auth/messages";
import { isFrigoraDirectAccessRequest } from "@/modules/frigora/app/direct-access";
import { FRIGORA_AUTH_SIGN_IN_TITLE } from "@/modules/frigora/app/pwa/copy";
import {
  frigoraCustomerFacingMetadata,
  frigoraCustomerFacingViewport,
} from "@/modules/frigora/app/pwa/identity";
import {
  FRIGORA_DIRECT_ENTRY_PATH,
  isFrigoraAuthContinuation,
} from "@/modules/frigora/app/pwa/paths";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  if (isFrigoraAuthContinuation(next)) {
    return {
      ...frigoraCustomerFacingMetadata(),
      title: { absolute: FRIGORA_AUTH_SIGN_IN_TITLE },
    };
  }
  return { title: "Sign in" };
}

export async function generateViewport({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}): Promise<Viewport> {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  if (isFrigoraAuthContinuation(next)) {
    return frigoraCustomerFacingViewport;
  }
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[]; reset?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const error = typeof params.error === "string" ? params.error : "";
  const reset = params.reset === "1";
  const headerList = await headers();
  if (
    next === "" &&
    isFrigoraDirectAccessRequest(headerList.get("host"), headerList.get("x-forwarded-host"))
  ) {
    const target = new URLSearchParams();
    target.set("next", FRIGORA_DIRECT_ENTRY_PATH);
    if (reset) target.set("reset", "1");
    if (error) target.set("error", error);
    redirect(`/login?${target.toString()}`);
  }

  return (
    <LoginScreen
      next={next}
      errorCode={reset ? undefined : error || undefined}
      error={reset ? undefined : error ? loginMessages[error] : undefined}
      notice={reset ? loginMessages.reset : undefined}
    />
  );
}
