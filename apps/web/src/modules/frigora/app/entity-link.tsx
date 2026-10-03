"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatFrigoraAssetLabel,
  formatFrigoraSiteAddress,
  frigoraAssetHref,
  frigoraCustomerHref,
  frigoraSiteHref,
  frigoraVisitHref,
  frigoraWorkOrderHref,
  type FrigoraSiteAddressSource,
} from "@/modules/frigora/app/entity-routes";

/**
 * Semantic link for a Frigora entity that already has a product route.
 * Renders an anchor so keyboard activation, focus, and native link actions
 * stay with the browser. Missing identities render text, never an empty href.
 */
export function FrigoraEntityLink({
  href,
  children,
  label,
}: {
  href: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <Link href={href} className="vos-entity-link" aria-label={label}>
      {children}
    </Link>
  );
}

type CustomerRef = { id: string; displayName: string } | null | undefined;

export function FrigoraCustomerLink({
  ventureId,
  customer,
}: {
  ventureId: string;
  customer: CustomerRef;
}) {
  if (!customer?.id || !customer.displayName.trim()) {
    return "—";
  }
  return (
    <FrigoraEntityLink href={frigoraCustomerHref(ventureId, customer.id)}>
      {customer.displayName}
    </FrigoraEntityLink>
  );
}

type SiteRef = { id: string; customerId: string; name: string } | null | undefined;

export function FrigoraSiteLink({
  ventureId,
  site,
}: {
  ventureId: string;
  site: SiteRef;
}) {
  if (!site?.id || !site.customerId || !site.name.trim()) {
    return "—";
  }
  return (
    <FrigoraEntityLink href={frigoraSiteHref(ventureId, site.customerId, site.id)}>
      {site.name}
    </FrigoraEntityLink>
  );
}

type SiteAddressRef = ({ id: string; customerId: string; name: string } & FrigoraSiteAddressSource) | null | undefined;

export function FrigoraSiteAddressLink({
  ventureId,
  site,
}: {
  ventureId: string;
  site: SiteAddressRef;
}) {
  if (!site?.id || !site.customerId) {
    return "—";
  }
  const address = formatFrigoraSiteAddress(site);
  if (!address) {
    return "—";
  }
  const name = site.name.trim() ? site.name : "Site";
  return (
    <FrigoraEntityLink
      href={frigoraSiteHref(ventureId, site.customerId, site.id)}
      label={`${name}, ${address}`}
    >
      {address}
    </FrigoraEntityLink>
  );
}

export function FrigoraSiteIdentityLink({
  ventureId,
  site,
}: {
  ventureId: string;
  site: SiteAddressRef;
}) {
  if (!site?.id || !site.customerId || !site.name.trim()) {
    return "—";
  }
  const address = formatFrigoraSiteAddress(site);
  return (
    <FrigoraEntityLink href={frigoraSiteHref(ventureId, site.customerId, site.id)}>
      {address ? `${site.name} · ${address}` : site.name}
    </FrigoraEntityLink>
  );
}

type AssetRef = {
  id: string;
  siteId: string;
  tag: string;
  name: string | null;
} | null | undefined;

export function FrigoraAssetLink({
  ventureId,
  customerId,
  siteId,
  asset,
}: {
  ventureId: string;
  customerId: string | null | undefined;
  siteId: string | null | undefined;
  asset: AssetRef;
}) {
  if (!asset?.id || !asset.tag.trim()) {
    return "—";
  }
  const label = formatFrigoraAssetLabel(asset);
  const resolvedSiteId = siteId || asset.siteId;
  if (!customerId || !resolvedSiteId) {
    return label;
  }
  return (
    <FrigoraEntityLink
      href={frigoraAssetHref(ventureId, customerId, resolvedSiteId, asset.id)}
    >
      {label}
    </FrigoraEntityLink>
  );
}

export function FrigoraWorkOrderLink({
  ventureId,
  workOrderId,
  workReference,
}: {
  ventureId: string;
  workOrderId: string;
  workReference: string;
}) {
  if (!workOrderId || !workReference.trim()) {
    return workReference.trim() ? workReference : "—";
  }
  return (
    <FrigoraEntityLink href={frigoraWorkOrderHref(ventureId, workOrderId)}>
      {workReference}
    </FrigoraEntityLink>
  );
}

export function FrigoraVisitLink({
  ventureId,
  workOrderId,
  visitId,
  children,
}: {
  ventureId: string;
  workOrderId: string;
  visitId: string;
  children: ReactNode;
}) {
  if (!workOrderId || !visitId) {
    return children;
  }
  return (
    <FrigoraEntityLink href={frigoraVisitHref(ventureId, workOrderId, visitId)}>
      {children}
    </FrigoraEntityLink>
  );
}

export function FrigoraCustomerSiteLinks({
  ventureId,
  customer,
  site,
  separator = " / ",
}: {
  ventureId: string;
  customer: CustomerRef;
  site: SiteRef;
  separator?: string;
}) {
  return (
    <>
      <FrigoraCustomerLink ventureId={ventureId} customer={customer} />
      {separator}
      <FrigoraSiteLink ventureId={ventureId} site={site} />
    </>
  );
}
