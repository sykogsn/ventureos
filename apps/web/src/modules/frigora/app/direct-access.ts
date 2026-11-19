import type { Role } from "@/contracts";
import {
  FRIGORA_DIRECT_ENTRY_PATH,
  frigoraAssignedWorkPath,
} from "@/modules/frigora/app/pwa/paths";

/** Public customer hostname. Other hosts keep the VentureOS entry. */
export const FRIGORA_DIRECT_ACCESS_HOSTNAME = "frigora.ventureoperatingsystem.co.za";

const SAFE_RESOURCE_ID = /^[A-Za-z0-9_-]+$/;

export function isFrigoraDirectAccessHost(rawHost: string | null | undefined): boolean {
  if (!rawHost) return false;
  const first = rawHost.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first || first.includes("/") || first.includes("\\") || /\s/.test(first)) return false;
  try {
    return new URL(`http://${first}`).hostname === FRIGORA_DIRECT_ACCESS_HOSTNAME;
  } catch {
    return false;
  }
}

export function isFrigoraDirectAccessRequest(
  host: string | null | undefined,
  forwardedHost: string | null | undefined,
): boolean {
  return isFrigoraDirectAccessHost(forwardedHost) || isFrigoraDirectAccessHost(host);
}

export type FrigoraDirectAccessDecision =
  | { kind: "continue" }
  | { kind: "login" }
  | { kind: "enter" };

/**
 * Root of the Frigora hostname only.
 * Every other path, including VentureOS routes on that host, is left unchanged.
 */
export function decideFrigoraDirectAccess(input: {
  host: string | null;
  forwardedHost: string | null;
  pathname: string;
  authenticated: boolean;
}): FrigoraDirectAccessDecision {
  if (input.pathname !== "/") return { kind: "continue" };
  if (!isFrigoraDirectAccessRequest(input.host, input.forwardedHost)) {
    return { kind: "continue" };
  }
  return input.authenticated ? { kind: "enter" } : { kind: "login" };
}

/** Signed-in visits to /login on the Frigora hostname continue into Frigora, not the founding desk. */
export function frigoraSignedInLoginRedirect(input: {
  host: string | null;
  forwardedHost: string | null;
  pathname: string;
}): string | null {
  if (input.pathname !== "/login") return null;
  if (!isFrigoraDirectAccessRequest(input.host, input.forwardedHost)) return null;
  return FRIGORA_DIRECT_ENTRY_PATH;
}

export function frigoraDirectLoginPath(): string {
  return `/login?next=${encodeURIComponent(FRIGORA_DIRECT_ENTRY_PATH)}`;
}

export type AuthorisedFrigoraAccess = {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  role: Role;
};

export function isSafeFrigoraResourceId(id: string): boolean {
  return SAFE_RESOURCE_ID.test(id);
}

export function frigoraDirectDestination(
  access: Pick<AuthorisedFrigoraAccess, "id" | "role">,
): string | null {
  if (!isSafeFrigoraResourceId(access.id)) return null;
  if (access.role === "owner" || access.role === "admin") {
    return `/ventures/${access.id}/operations`;
  }
  if (access.role === "member") {
    return frigoraAssignedWorkPath(access.id);
  }
  return null;
}

export function frigoraDirectDestinationLabel(role: Role): "Operations" | "My Work" {
  return role === "owner" || role === "admin" ? "Operations" : "My Work";
}

export type FrigoraDirectChoice =
  | { mode: "open"; path: string; workspaceId: string; ventureId: string }
  | { mode: "choose" };

/**
 * Opens a destination only when exactly one authorised Frigora venture exists.
 * Zero and many both stay on the explicit chooser. List order is not a choice.
 */
export function chooseFrigoraDirectAccess(
  ventures: readonly AuthorisedFrigoraAccess[],
): FrigoraDirectChoice {
  if (ventures.length !== 1) return { mode: "choose" };
  const only = ventures[0];
  if (!only || !isSafeFrigoraResourceId(only.workspaceId)) return { mode: "choose" };
  const path = frigoraDirectDestination(only);
  if (!path) return { mode: "choose" };
  return {
    mode: "open",
    path,
    workspaceId: only.workspaceId,
    ventureId: only.id,
  };
}
