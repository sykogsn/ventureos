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

function pathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function frigoraCustomerHref(ventureId: string, customerId: string): string {
  return `/ventures/${pathSegment(ventureId)}/customers/${pathSegment(customerId)}`;
}

export function frigoraSiteHref(
  ventureId: string,
  customerId: string,
  siteId: string,
): string {
  return `${frigoraCustomerHref(ventureId, customerId)}/sites/${pathSegment(siteId)}`;
}

export function frigoraAssetHref(
  ventureId: string,
  customerId: string,
  siteId: string,
  assetId: string,
): string {
  return `${frigoraSiteHref(ventureId, customerId, siteId)}/assets/${pathSegment(assetId)}`;
}

export function frigoraWorkOrderHref(ventureId: string, workOrderId: string): string {
  return `/ventures/${pathSegment(ventureId)}/work/${pathSegment(workOrderId)}`;
}

export function frigoraVisitHref(
  ventureId: string,
  workOrderId: string,
  visitId: string,
): string {
  return `${frigoraWorkOrderHref(ventureId, workOrderId)}/visit/${pathSegment(visitId)}`;
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
