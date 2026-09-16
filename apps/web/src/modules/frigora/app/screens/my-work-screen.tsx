import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Fit, Stack } from "@/core/layout";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import type { MyWorkRow } from "@/modules/frigora/app/views";

function previewText(text: string | null, max = 120): string {
  if (!text) {
    return "—";
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatSiteAddress(site: MyWorkRow["site"]): string {
  if (!site) return "—";
  return [
    site.addressLine1,
    site.addressLine2,
    site.city,
    site.region,
    site.postalCode,
    site.country,
  ]
    .filter(Boolean)
    .join(", ") || "—";
}

export function MyWorkScreen({
  ctx,
  rows,
  error,
}: {
  ctx: FrigoraOpsContext;
  rows: MyWorkRow[];
  error?: string;
}) {
  const base = `/ventures/${ctx.ventureId}/work`;

  return (
    <PageFrame
      page="My Work"
      kicker="Field"
      title="My Work"
      description="Open work orders assigned to you."
      ventureId={ctx.ventureId}
      actions={
        ctx.canWrite ? (
          <Fit>
            <Link href={base} className="vos-btn-secondary">
              All work
            </Link>
          </Fit>
        ) : undefined
      }
    >
      <Stack gap="section">
        {error ? (
          <p className="ids-caption text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <EmptyCopy title="No open work assigned to you">
            When a work order is assigned to you, it appears here.
          </EmptyCopy>
        ) : (
          <Stack gap="compact">
            {rows.map(
              ({
                workOrder,
                customer,
                site,
                asset,
                activeVisit,
                latestVisit,
                responseState,
              }) => (
              <article
                key={workOrder.id}
                className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4"
              >
                <Stack gap="tight">
                  <div>
                    <Link
                      href={`${base}/${workOrder.id}`}
                      className="ids-label text-foreground underline-offset-2 hover:underline"
                    >
                      {workOrder.workReference}
                    </Link>
                    <p className="ids-caption text-muted">
                      {customer?.displayName ?? "—"} · {site?.name ?? "—"}
                    </p>
                  </div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="ids-caption text-muted">Kind</dt>
                      <dd className="ids-body">{workOrder.workKind}</dd>
                    </div>
                    <div>
                      <dt className="ids-caption text-muted">Status</dt>
                      <dd className="ids-body">
                        {activeVisit
                          ? "Visit in progress"
                          : latestVisit?.status === "departed"
                            ? "Visit finished · work order open"
                            : "Ready for visit"}
                      </dd>
                    </div>
                    <div>
                      <dt className="ids-caption text-muted">Service window</dt>
                      <dd className="ids-body">
                        {workOrder.scheduledStartAt && workOrder.scheduledEndAt
                          ? `${workOrder.scheduledStartAt} → ${workOrder.scheduledEndAt}`
                          : "Not scheduled"}
                      </dd>
                    </div>
                    <div>
                      <dt className="ids-caption text-muted">Assignment response</dt>
                      <dd className="ids-body">{responseState.replaceAll("_", " ")}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="ids-caption text-muted">Site address</dt>
                      <dd className="ids-body break-words">{formatSiteAddress(site)}</dd>
                    </div>
                    {asset ? (
                      <div className="sm:col-span-2">
                        <dt className="ids-caption text-muted">Asset</dt>
                        <dd className="ids-body">
                          {asset.tag}
                          {asset.name ? ` — ${asset.name}` : ""}
                        </dd>
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <dt className="ids-caption text-muted">Reported condition</dt>
                      <dd className="ids-body break-words">
                        {previewText(workOrder.reportedCondition)}
                      </dd>
                    </div>
                  </dl>
                  <Link
                      href={
                        activeVisit
                          ? `${base}/${workOrder.id}/visit/${activeVisit.id}`
                          : `${base}/${workOrder.id}`
                      }
                      className="vos-btn-primary w-full sm:w-auto"
                    >
                      {activeVisit ? "Continue visit" : "Open assigned job"}
                    </Link>
                </Stack>
              </article>
              ),
            )}
          </Stack>
        )}
      </Stack>
    </PageFrame>
  );
}
