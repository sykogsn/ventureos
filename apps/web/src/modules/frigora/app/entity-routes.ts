import { ventureEntityPath } from "@/core/navigation/entity-routes";

/**
 * Frigora operational entity routes.
 *
 * These helpers are the only place that assembles customer, site, asset,
 * work order, and visit hrefs. They follow the App Router contracts under
 * `/ventures/[ventureId]/…` and keep the current venture in the path.
 * They do not grant access. Destination pages keep the existing
 * `requireFrigoraOpsContext` check.
 */

export type FrigoraSiteAddressSource = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
};

export function frigoraCustomerHref(ventureId: string, customerId: string): string {
  return ventureEntityPath(ventureId, "customers", customerId);
}

export function frigoraSiteHref(
  ventureId: string,
  customerId: string,
  siteId: string,
): string {
  return ventureEntityPath(ventureId, "customers", customerId, "sites", siteId);
}

export function frigoraAssetHref(
  ventureId: string,
  customerId: string,
  siteId: string,
  assetId: string,
): string {
  return ventureEntityPath(
    ventureId,
    "customers",
    customerId,
    "sites",
    siteId,
    "assets",
    assetId,
  );
}

export function frigoraWorkOrderHref(ventureId: string, workOrderId: string): string {
  return ventureEntityPath(ventureId, "work", workOrderId);
}

export function frigoraVisitHref(
  ventureId: string,
  workOrderId: string,
  visitId: string,
): string {
  return ventureEntityPath(ventureId, "work", workOrderId, "visit", visitId);
}

export function formatFrigoraSiteAddress(
  site: FrigoraSiteAddressSource | null | undefined,
): string {
  if (!site) {
    return "";
  }
  return [
    site.addressLine1,
    site.addressLine2,
    site.city,
    site.region,
    site.postalCode,
    site.country,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
}

export function formatFrigoraAssetLabel(asset: {
  tag: string;
  name: string | null;
}): string {
  return asset.name && asset.name.trim() ? `${asset.tag} — ${asset.name}` : asset.tag;
}
