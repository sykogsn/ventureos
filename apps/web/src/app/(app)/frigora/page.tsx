import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { UserId } from "@/contracts";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Stack } from "@/core/layout";
import { getSession } from "@/lib/auth/session";
import { openAuthorisedFrigoraVenture } from "@/modules/frigora/app/direct-access-action";
import { frigoraDirectDestinationLabel } from "@/modules/frigora/app/direct-access";
import { listAuthorisedFrigoraVentures } from "@/modules/frigora/app/direct-access-resolve";
import {
  FRIGORA_PWA_DESCRIPTION,
  FRIGORA_PWA_NAME,
} from "@/modules/frigora/app/pwa/copy";
import { FRIGORA_DIRECT_ENTRY_PATH } from "@/modules/frigora/app/pwa/paths";

export const dynamic = "force-dynamic";

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
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(FRIGORA_DIRECT_ENTRY_PATH)}`);
  }

  const ventures = await listAuthorisedFrigoraVentures(session.id as UserId);
  if (ventures.length === 1) {
    redirect(FRIGORA_DIRECT_ENTRY_PATH);
  }

  return (
    <PageFrame
      page="Frigora"
      kicker="Frigora"
      title="Frigora"
      description={
        ventures.length === 0
          ? "Frigora opens only a company your organisation has already authorised."
          : "You are authorised for more than one Frigora company. Choose which one to open."
      }
    >
      {ventures.length === 0 ? (
        <EmptyCopy title="No Frigora company for this sign-in">
          This account is not a member of a Frigora company. Ask your organisation to grant
          access. This page does not start a new company.
        </EmptyCopy>
      ) : (
        <form action={openAuthorisedFrigoraVenture}>
          <Stack gap="compact">
            {ventures.map((venture) => (
              <button
                key={venture.id}
                type="submit"
                name="ventureId"
                value={venture.id}
                className="ids-label rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4 text-left text-foreground"
              >
                <span className="block">{venture.name}</span>
                <span className="ids-caption mt-1 block text-muted">{venture.workspaceName}</span>
                <span className="ids-caption mt-1 block text-muted">
                  {frigoraDirectDestinationLabel(venture.role)}
                </span>
              </button>
            ))}
          </Stack>
        </form>
      )}
    </PageFrame>
  );
}
