export const FRIGORA_PWA_START_PATH = "/frigora";
export const FRIGORA_PWA_MANIFEST_PATH = "/frigora-manifest.webmanifest";
export const VENTUREOS_ORIGIN_MANIFEST_PATH = "/manifest.webmanifest";
export const FRIGORA_PWA_SERVICE_WORKER_PATH = "/sw.js";
export const FRIGORA_PWA_OFFLINE_PATH = "/offline.html";
export const FRIGORA_PWA_ICON_SIZES = [180, 192, 512] as const;

export const FRIGORA_PWA_ICON_PATHS = {
  apple: "/frigora-icon/180",
  icon192: "/frigora-icon/192",
  icon512: "/frigora-icon/512",
} as const;

export function frigoraIconPath(size: number): string {
  return `/frigora-icon/${size}`;
}

export function frigoraAssignedWorkPath(ventureId: string): string {
  return `/ventures/${ventureId}/work/assigned`;
}

export function isFrigoraPwaPublicPath(pathname: string): boolean {
  return (
    pathname === FRIGORA_PWA_SERVICE_WORKER_PATH ||
    pathname === FRIGORA_PWA_OFFLINE_PATH ||
    pathname === FRIGORA_PWA_MANIFEST_PATH ||
    pathname === VENTUREOS_ORIGIN_MANIFEST_PATH ||
    pathname.startsWith("/frigora-icon/")
  );
}

export function isFrigoraFieldPath(pathname: string): boolean {
  if (pathname === FRIGORA_PWA_START_PATH) {
    return true;
  }
  return /\/ventures\/[^/]+\/work(\/|$)/.test(pathname);
}

/**
 * Authenticated Frigora customer journey surfaces (field + Owner ops/commercial).
 * Used for customer-facing shell chrome. Offline mutation gating stays on
 * {@link isFrigoraFieldPath} only.
 */
export function isFrigoraCustomerPath(pathname: string): boolean {
  if (pathname === FRIGORA_PWA_START_PATH) {
    return true;
  }
  return /\/ventures\/[^/]+\/(work|operations|customers|catalogue)(\/|$)/.test(
    pathname,
  );
}

export function frigoraPathname(raw: string): string {
  return raw.trim().split(/[?#]/, 1)[0] ?? "";
}

export function isFrigoraAuthContinuation(next: string): boolean {
  return isFrigoraCustomerPath(frigoraPathname(next));
}
