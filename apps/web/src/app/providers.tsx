"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/core/theme/theme-provider";
import { FrigoraConnectivityBanner } from "@/modules/frigora/app/pwa/connectivity-banner";
import { RegisterFrigoraServiceWorker } from "@/modules/frigora/app/pwa/register-service-worker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <RegisterFrigoraServiceWorker />
      <FrigoraConnectivityBanner />
      {children}
    </ThemeProvider>
  );
}
