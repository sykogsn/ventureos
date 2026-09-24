"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ExecutiveLoading } from "@/core/shell/executive-loading";
import {
  FRIGORA_AUTH_LOADING_MESSAGE,
  FRIGORA_PWA_NAME,
} from "@/modules/frigora/app/pwa/copy";
import { isFrigoraAuthContinuation } from "@/modules/frigora/app/pwa/paths";

/**
 * Neutral pending chrome while search params resolve — no VentureOS mark.
 * Avoids flashing platform identity during Frigora continuation.
 */
function NeutralAuthRouteLoading() {
  return <ExecutiveLoading productName="" message="Opening..." />;
}

function FrigoraAwareAuthRouteLoadingInner() {
  const next = useSearchParams().get("next") ?? "";
  if (isFrigoraAuthContinuation(next)) {
    return (
      <ExecutiveLoading
        productName={FRIGORA_PWA_NAME}
        message={FRIGORA_AUTH_LOADING_MESSAGE}
      />
    );
  }
  return <ExecutiveLoading message="Opening the desk..." />;
}

export function FrigoraAwareAuthRouteLoading() {
  return (
    <Suspense fallback={<NeutralAuthRouteLoading />}>
      <FrigoraAwareAuthRouteLoadingInner />
    </Suspense>
  );
}
