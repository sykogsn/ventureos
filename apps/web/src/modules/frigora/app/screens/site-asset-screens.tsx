import type { ReactNode } from "react";
import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Fit, Stack } from "@/core/layout";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  FrigoraCustomerLink,
  FrigoraEntityLink,
  FrigoraSiteLink,
} from "@/modules/frigora/app/entity-link";
import {
  frigoraAssetHref,
  frigoraCustomerHref,
  frigoraSiteHref,
} from "@/modules/frigora/app/entity-routes";
import type { FrigoraAsset, FrigoraCustomer, FrigoraSite } from "@/modules/frigora/types";

export function SiteDetailScreen({
  ctx,
  customer,
  site,
  assets,
  createAssetSlot,
}: {
  ctx: FrigoraOpsContext;
  customer: FrigoraCustomer;
  site: FrigoraSite;
  assets: FrigoraAsset[];
  createAssetSlot?: ReactNode;
}) {
  const customerHref = frigoraCustomerHref(ctx.ventureId, customer.id);
  const workNewHref = `/ventures/${ctx.ventureId}/work/new?siteId=${encodeURIComponent(site.id)}&customerId=${encodeURIComponent(customer.id)}`;

  return (
    <PageFrame
      page={site.name}
      kicker="Site"
      title={site.name}
      description={
        <>
          <FrigoraCustomerLink ventureId={ctx.ventureId} customer={customer} />
          {` · ${site.code}`}
        </>
      }
      meta={site.status}
      ventureId={ctx.ventureId}
      actions={
        <Fit>
          <Stack gap="tight">
            <Link href={customerHref} className="vos-btn-secondary">
              Back to customer
            </Link>
            {ctx.canWrite ? (
              <Link href={workNewHref} className="vos-btn-primary">
                Create work order
              </Link>
            ) : null}
          </Stack>
        </Fit>
      }
    >
      <Stack gap="section">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="ids-caption text-muted">Customer</dt>
            <dd className="ids-body">
              <FrigoraCustomerLink ventureId={ctx.ventureId} customer={customer} />
            </dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Address</dt>
            <dd className="ids-body">
              {[site.addressLine1, site.addressLine2, site.city, site.region, site.postalCode, site.country]
                .filter(Boolean)
                .join(", ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Notes</dt>
            <dd className="ids-body whitespace-pre-wrap">{site.notes ?? "—"}</dd>
          </div>
        </dl>

        <Stack gap="compact">
          <h2 className="ids-label text-foreground">Assets</h2>
          {assets.length === 0 ? (
            <EmptyCopy title="No assets yet">
              Register an asset for this site when equipment is known. Work orders may omit a primary
              asset.
            </EmptyCopy>
          ) : (
            <ul className="divide-y divide-[var(--ids-foundation-stroke-subtle)]">
              {assets.map((asset) => (
                <li key={asset.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <FrigoraEntityLink
                    href={frigoraAssetHref(ctx.ventureId, customer.id, site.id, asset.id)}
                  >
                    {asset.tag}
                    {asset.name ? ` — ${asset.name}` : ""}
                  </FrigoraEntityLink>
                  <span className="ids-caption text-muted">{asset.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Stack>

        {createAssetSlot}
      </Stack>
    </PageFrame>
  );
}

export function AssetDetailScreen({
  ctx,
  customer,
  site,
  asset,
}: {
  ctx: FrigoraOpsContext;
  customer: FrigoraCustomer;
  site: FrigoraSite;
  asset: FrigoraAsset;
}) {
  const siteHref = frigoraSiteHref(ctx.ventureId, customer.id, site.id);
  const workNewHref = `/ventures/${ctx.ventureId}/work/new?siteId=${encodeURIComponent(site.id)}&customerId=${encodeURIComponent(customer.id)}&primaryAssetId=${encodeURIComponent(asset.id)}`;

  return (
    <PageFrame
      page={asset.tag}
      kicker="Asset"
      title={asset.name ?? asset.tag}
      description={
        <>
          <FrigoraSiteLink ventureId={ctx.ventureId} site={site} />
          {" · "}
          <FrigoraCustomerLink ventureId={ctx.ventureId} customer={customer} />
        </>
      }
      meta={asset.status}
      ventureId={ctx.ventureId}
      actions={
        <Fit>
          <Stack gap="tight">
            <Link href={siteHref} className="vos-btn-secondary">
              Back to site
            </Link>
            {ctx.canWrite ? (
              <Link href={workNewHref} className="vos-btn-primary">
                Create work order
              </Link>
            ) : null}
          </Stack>
        </Fit>
      }
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="ids-caption text-muted">Customer</dt>
          <dd className="ids-body">
            <FrigoraCustomerLink ventureId={ctx.ventureId} customer={customer} />
          </dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Site</dt>
          <dd className="ids-body">
            <FrigoraSiteLink ventureId={ctx.ventureId} site={site} />
          </dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Tag</dt>
          <dd className="ids-body">{asset.tag}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Identity status</dt>
          <dd className="ids-body">{asset.status}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Asset kind</dt>
          <dd className="ids-body">{asset.assetKind?.replaceAll("_", " ") ?? "—"}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Manufacturer / model</dt>
          <dd className="ids-body">
            {[asset.manufacturer, asset.model].filter(Boolean).join(" · ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Serial number</dt>
          <dd className="ids-body">{asset.serialNumber ?? "—"}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Design target (°C)</dt>
          <dd className="ids-body">
            {asset.designTargetCelsius !== null ? String(asset.designTargetCelsius) : "—"}
          </dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Refrigerant type</dt>
          <dd className="ids-body">{asset.refrigerantType ?? "—"}</dd>
        </div>
        <div>
          <dt className="ids-caption text-muted">Location on site</dt>
          <dd className="ids-body">{asset.locationOnSite ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="ids-caption text-muted">Notes</dt>
          <dd className="ids-body whitespace-pre-wrap">{asset.notes ?? "—"}</dd>
        </div>
      </dl>
      <p className="ids-caption text-muted mt-6">
        Identity status is not operational condition. Operational condition and asset history are not
        part of F1.1.
      </p>
    </PageFrame>
  );
}
