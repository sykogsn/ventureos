import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { getShellSnapshot } from "@/core/shell/snapshot";
import { Stack } from "@/core/layout";
import {
  FRIGORA_PWA_DESCRIPTION,
  FRIGORA_PWA_NAME,
} from "@/modules/frigora/app/pwa/copy";
import {
  listFrigoraPwaVentures,
  resolveFrigoraPwaStart,
} from "@/modules/frigora/app/pwa/landing";
import { frigoraAssignedWorkPath } from "@/modules/frigora/app/pwa/paths";

export const metadata: Metadata = {
  title: { absolute: FRIGORA_PWA_NAME },
  applicationName: FRIGORA_PWA_NAME,
  description: FRIGORA_PWA_DESCRIPTION,
  appleWebApp: {
    capable: true,
    title: FRIGORA_PWA_NAME,
    statusBarStyle: "default",
  },
};

export default async function FrigoraPwaStartPage() {
  const snapshot = await getShellSnapshot();
  const destination = resolveFrigoraPwaStart(snapshot.ventures);
  if (destination) {
    redirect(destination);
  }

  const ventures = listFrigoraPwaVentures(snapshot.ventures);

  return (
    <PageFrame
      page="Frigora"
      kicker="Frigora"
      title="Frigora"
      description="Open assigned field work for a Frigora company in this workspace."
    >
      {ventures.length === 0 ? (
        <EmptyCopy title="No Frigora company in this workspace">
          Frigora field work is available after a Frigora company is founded in the
          active workspace.
        </EmptyCopy>
      ) : (
        <Stack gap="compact">
          {ventures.map((venture) => (
            <Link
              key={venture.id}
              href={frigoraAssignedWorkPath(venture.id)}
              className="ids-label rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4 text-foreground"
            >
              {venture.name}
            </Link>
          ))}
        </Stack>
      )}
    </PageFrame>
  );
}
