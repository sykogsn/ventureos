import Link from "next/link";
import { PageFrame } from "@/core";
import { Fit, Stack } from "@/core/layout";
import { StartVisitForm } from "@/modules/frigora/app/forms/start-visit-form";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import type { VisitEntryView } from "@/modules/frigora/app/views";

export function VisitEntryScreen({
  ctx,
  view,
}: {
  ctx: FrigoraOpsContext;
  view: VisitEntryView;
}) {
  const { workOrder, customer, site, asset } = view;
  const workBase = `/ventures/${ctx.ventureId}/work/${workOrder.id}`;
  const siteAddress = site
    ? [
        site.addressLine1,
        site.addressLine2,
        site.city,
        site.region,
        site.postalCode,
        site.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <PageFrame
      page="Start visit"
      kicker={workOrder.workReference}
      title="Start visit"
      description={`${customer?.displayName ?? "Customer"} · ${site?.name ?? "Site"}`}
      ventureId={ctx.ventureId}
      actions={
        <Fit>
          <Link href={workBase} className="vos-btn-secondary">
            Back to work order
          </Link>
        </Fit>
      }
    >
      <Stack gap="section">
        <dl className="grid gap-3">
          <div>
            <dt className="ids-caption text-muted">Site address</dt>
            <dd className="ids-body">{siteAddress || "—"}</dd>
          </div>
          <div>
            <dt className="ids-caption text-muted">Service window</dt>
            <dd className="ids-body">
              {workOrder.scheduledStartAt && workOrder.scheduledEndAt
                ? `${workOrder.scheduledStartAt} → ${workOrder.scheduledEndAt}`
                : "Not scheduled"}
            </dd>
          </div>
          {asset ? (
            <div>
              <dt className="ids-caption text-muted">Asset</dt>
              <dd className="ids-body">
                {asset.tag}
                {asset.name ? ` — ${asset.name}` : ""}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="ids-caption text-muted">Reported condition</dt>
            <dd className="ids-body whitespace-pre-wrap">
              {workOrder.reportedCondition ?? "—"}
            </dd>
          </div>
        </dl>
        <p className="ids-caption text-muted">
          Starting a visit records your arrival as the authenticated engineer assigned
          to this work order. None of the truth sections are required before finishing.
        </p>
        <StartVisitForm
          workspaceId={ctx.workspaceId}
          ventureId={ctx.ventureId}
          workOrderId={workOrder.id}
        />
      </Stack>
    </PageFrame>
  );
}
