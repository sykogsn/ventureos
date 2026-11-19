"use server";

import { redirect } from "next/navigation";
import type { UserId } from "@/contracts";
import { getSession, setActiveWorkspaceCookie } from "@/lib/auth/session";
import {
  frigoraDirectDestination,
  frigoraDirectLoginPath,
  isSafeFrigoraResourceId,
} from "@/modules/frigora/app/direct-access";
import { listAuthorisedFrigoraVentures } from "@/modules/frigora/app/direct-access-resolve";

/** Opens one venture the signed-in user is already authorised to read. */
export async function openAuthorisedFrigoraVenture(formData: FormData) {
  const session = await getSession();
  if (!session) {
    redirect(frigoraDirectLoginPath());
  }

  const ventureId = formData.get("ventureId");
  if (typeof ventureId !== "string" || !isSafeFrigoraResourceId(ventureId)) {
    redirect("/frigora");
  }

  const authorised = await listAuthorisedFrigoraVentures(session.id as UserId);
  const match = authorised.find((venture) => venture.id === ventureId);
  const path = match ? frigoraDirectDestination(match) : null;
  if (!match || !path) {
    redirect("/frigora");
  }

  await setActiveWorkspaceCookie(match.workspaceId);
  redirect(path);
}
