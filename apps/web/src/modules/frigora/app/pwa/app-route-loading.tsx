"use client";

import { usePathname } from "next/navigation";
import { ExecutiveLoading } from "@/core/shell/executive-loading";
import {
  FRIGORA_AUTH_LOADING_MESSAGE,
  FRIGORA_PWA_NAME,
} from "@/modules/frigora/app/pwa/copy";
import { isFrigoraCustomerPath } from "@/modules/frigora/app/pwa/paths";

const DEFAULT_PLATFORM_LOADING_MESSAGE =
  "Synchronising Executive Workspace...";

/**
 * Authenticated app-shell loading. Frigora customer paths must not flash
 * VentureOS / Executive Workspace copy.
 */
export function FrigoraAwareAppRouteLoading({
  platformMessage = DEFAULT_PLATFORM_LOADING_MESSAGE,
}: {
  platformMessage?: string;
} = {}) {
  const pathname = usePathname() ?? "";

  if (!pathname) {
    return <ExecutiveLoading productName="" message="Opening..." />;
  }

  if (isFrigoraCustomerPath(pathname)) {
    return (
      <ExecutiveLoading
        productName={FRIGORA_PWA_NAME}
        message={FRIGORA_AUTH_LOADING_MESSAGE}
      />
    );
  }

  return <ExecutiveLoading message={platformMessage} />;
}
