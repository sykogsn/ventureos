import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Stack } from "@/core/layout";
import { CreateQuotationForm } from "@/modules/frigora/app/forms/quotation-forms";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import { QUOTATION_ISSUE_OFFICE_NOTICE } from "@/modules/frigora/quotation-delivery";
import { formatZarMinor } from "@/modules/frigora/app/quotation-office";
import type { QuotationCreateSource } from "@/modules/frigora/queries";
import type { FrigoraPersistedQuotation } from "@/modules/frigora/types";

function quotationHref(ventureId: string, quotationId: string) {
  return `/ventures/${ventureId}/quotations/${quotationId}`;
}

export function QuotationsScreen({
  ctx,
  quotations,
  sources,
  error,
}: {
  ctx: FrigoraOpsContext;
  quotations: FrigoraPersistedQuotation[];
  sources: QuotationCreateSource[];
  error?: string;
}) {
  return (
    <PageFrame
      page="Quotations"
      kicker="Frigora operations"
      title="Quotations"
      description="Draft and review quotations for recommended work. A draft is not an issued quotation."
      ventureId={ctx.ventureId}
    >
      <Stack gap="section">
        <p className="ids-caption text-muted" role="status">
          {QUOTATION_ISSUE_OFFICE_NOTICE}{" "}
          <Link href={`/ventures/${ctx.ventureId}/quotations/tax`}>Review tax configuration</Link>
        </p>
        {error ? (
          <p className="ids-caption text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {quotations.length === 0 ? (
          <EmptyCopy title="No quotations yet">
            Create a draft from a recommended action. The draft can be reviewed and corrected before issue is attempted.
          </EmptyCopy>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left">
              <thead>
                <tr className="ids-caption text-muted">
                  <th className="py-2 pr-4 font-medium">Quotation</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Version</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((quotation) => {
                  const current = quotation.versions.find(
                    (version) => version.version === quotation.currentVersion,
                  );
                  return (
                    <tr key={quotation.id} className="border-t border-border">
                      <td className="py-3 pr-4">
                        <Link href={quotationHref(ctx.ventureId, quotation.id)}>
                          {current?.description ?? quotation.id}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{current?.status ?? "Unknown"}</td>
                      <td className="py-3 pr-4">{quotation.currentVersion}</td>
                      <td className="py-3 pr-4">
                        {current ? `R ${formatZarMinor(current.totalMinor)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {ctx.canWrite ? (
          <section>
            <h2 className="mb-3 text-lg font-medium">New draft</h2>
            {sources.length === 0 ? (
              <EmptyCopy title="No recommended action to price">
                Record a recommended action on a work order before creating a quotation.
              </EmptyCopy>
            ) : (
              <CreateQuotationForm
                workspaceId={ctx.workspaceId}
                ventureId={ctx.ventureId}
                sources={sources}
              />
            )}
          </section>
        ) : (
          <p className="ids-caption text-muted">
            You can review quotations. Creating or correcting a draft requires permission to update this venture.
          </p>
        )}
      </Stack>
    </PageFrame>
  );
}
