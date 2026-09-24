import { Suspense, type ReactNode } from "react";
import {
  FrigoraAwareAuthExperienceBand,
  FrigoraAwareAuthExperiencePanel,
  FrigoraAwareAuthIdentity,
  NeutralAuthExperienceBand,
  NeutralAuthExperiencePanel,
  NeutralAuthIdentity,
} from "@/modules/frigora/app/pwa/auth-identity";

export function AuthEntranceShell({
  themeControl,
  children,
}: {
  themeControl: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-auth-entrance="" className="min-h-screen bg-surface-secondary">
      <a
        href="#sign-in"
        className="sr-only rounded-md bg-surface-elevated px-4 py-2 text-sm font-medium text-text-primary focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to sign in
      </a>

      <div className="flex min-h-screen flex-col">
        <div className="grid flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Suspense fallback={<NeutralAuthExperiencePanel />}>
            <FrigoraAwareAuthExperiencePanel />
          </Suspense>

          <div className="flex min-w-0 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6 lg:justify-end">
              <span className="lg:hidden">
                <Suspense fallback={<NeutralAuthIdentity />}>
                  <FrigoraAwareAuthIdentity />
                </Suspense>
              </span>
              {themeControl}
            </header>

            <main
              id="sign-in"
              className="flex flex-1 items-start justify-center px-4 pt-4 pb-14 sm:px-6 sm:pt-10 lg:items-center lg:px-10 lg:pt-0 lg:pb-20 xl:px-14"
            >
              <div className="w-full max-w-[24rem] lg:max-w-[25rem]">
                <Suspense fallback={<NeutralAuthExperienceBand />}>
                  <FrigoraAwareAuthExperienceBand />
                </Suspense>
                <div className="mt-7 lg:mt-0">{children}</div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
