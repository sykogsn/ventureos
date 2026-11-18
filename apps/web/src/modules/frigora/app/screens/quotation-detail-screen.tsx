import Link from "next/link";
import { PageFrame } from "@/core";
import { Stack } from "@/core/layout";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  ActivateCustomerAccessForm,
  CorrectQuotationContactForm,
  CorrectQuotationForm,
  CreateQuotationContactForm,
  DesignateQuotationContactForm,
  ReviseQuotationForm,
  RevokeCustomerAccessForm,
  RevokeQuotationDesignationForm,
  RevokeSupervisedVerificationForm,
  RecordSupervisedVerificationForm,
  SendQuotationForm,
} from "@/modules/frigora/app/forms/quotation-forms";
import {
  formatQuantityMilli,
  formatZarMinor,
} from "@/modules/frigora/app/quotation-office";
import {
  QUOTATION_CUSTOMER_ACCESS_MODEL,
  quotationOfficeDeliveryCopy,
  type QuotationCustomerDeliveryOfficeView,
  type QuotationDeliveryOutbox,
} from "@/modules/frigora/quotation-delivery";
import type {
  FrigoraCustomerContactAccess,
  FrigoraPersistedQuotation,
  FrigoraPersistedQuoteVersion,
} from "@/modules/frigora/types";

function money(minor: number) {
  return `R ${formatZarMinor(minor)}`;
}

function CommercialReview({ version }: { version: FrigoraPersistedQuoteVersion }) {
  const commercial = version.commercial;
  const rows: Array<[string, string]> = [
    ["Description", version.description],
    ["Status", version.status],
    ["Labour quantity", `${formatQuantityMilli(commercial.labourQuantityMilli)} ${commercial.labourUnit}`],
    ["Labour rate", `${money(commercial.labourRateMinor)} per ${commercial.labourUnit}`],
    ["Labour amount", money(commercial.labourAmountMinor)],
    ["Distance basis", commercial.distanceBasis === "one_way" ? "One-way" : "Return"],
    ["Travel kilometres", formatQuantityMilli(commercial.travelKilometresMilli)],
    ["Travel rate", `${money(commercial.travelRateMinor)} per kilometre`],
    ["Travel amount", money(commercial.travelAmountMinor)],
    ["Taxable amount", money(commercial.taxableAmountMinor)],
    ["Tax treatment", commercial.taxTreatment],
    ["Tax rule", commercial.taxRuleId ? `${commercial.taxRuleId} ${commercial.taxRuleVersion ?? ""}` : "None recorded"],
    [
      "Tax rate",
      commercial.taxRateNumerator == null || commercial.taxRateDenominator == null
        ? "None recorded"
        : `${commercial.taxRateNumerator}/${commercial.taxRateDenominator}`,
    ],
    ["Tax amount", money(commercial.taxAmountMinor)],
    ["Total", money(version.totalMinor)],
    ["Document hash", version.documentHash],
  ];
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="ids-caption text-muted">{label}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function accessLabel(
  state: OfficeCustomerAccessGrant["state"],
  decision: OfficeCustomerAccessGrant["decision"],
) {
  if (decision === "approved") return "approved";
  if (decision === "declined") return "declined";
  if (state === "revoked") return "access revoked";
  if (state === "consumed") return "consumed";
  if (state === "expired") return "expired";
  return "awaiting customer decision";
}

function decisionCopy(
  quotation: FrigoraPersistedQuotation,
  current: FrigoraPersistedQuoteVersion,
  operations: readonly QuotationCustomerDeliveryOfficeView[] = [],
) {
  const decision = quotation.decisions.find((item) => item.version === current.version);
  if (current.status === "in_preparation") {
    return "This version is a draft. It has not been issued, and no customer decision applies to it.";
  }
  if (current.status === "awaiting_customer_approval") {
    const operation = operations.find((item) => item.version === current.version);
    if (operation) {
      return `This version was issued and is awaiting a customer decision. Customer delivery is ${operation.state}. No approval or decline is recorded for it.`;
    }
    return "This version was issued and is awaiting a customer decision. No customer delivery operation is recorded, and no approval or decline is recorded for it.";
  }
  if (decision) {
    return `The customer ${decision.decision} version ${decision.version}. The decision is bound to document hash ${decision.documentHash}. Approval does not create a work order.`;
  }
  return `This version is ${current.status}. Approval does not create a work order.`;
}

function deliveryCopy(
  delivery: QuotationDeliveryOutbox | null,
  status: string | undefined,
  operations: readonly QuotationCustomerDeliveryOfficeView[] = [],
) {
  return quotationOfficeDeliveryCopy(delivery, status, operations);
}

export type OfficeCustomerAccessGrant = {
  id: string;
  version: number;
  documentHash: string;
  issuedAt: string;
  expiresAt: string;
  state: "active" | "expired" | "revoked" | "consumed";
  decision: "approved" | "declined" | null;
};

export function QuotationDetailScreen({
  ctx,
  quotation,
  delivery,
  customerDeliveries = [],
  accessGrants,
  contacts,
  customerName,
  siteName,
}: {
  ctx: FrigoraOpsContext;
  quotation: FrigoraPersistedQuotation;
  delivery: QuotationDeliveryOutbox | null;
  customerDeliveries?: readonly QuotationCustomerDeliveryOfficeView[];
  accessGrants: OfficeCustomerAccessGrant[];
  contacts: readonly FrigoraCustomerContactAccess[];
  customerName: string;
  siteName: string;
}) {
  const current = quotation.versions.find((version) => version.version === quotation.currentVersion);
  return (
    <PageFrame
      page="Quotation"
      kicker="Frigora operations"
      title={current?.description ?? "Quotation"}
      description="Review the commercial inputs and calculated amounts. Issue preparation can be held. It is not an email."
      ventureId={ctx.ventureId}
    >
      <Stack gap="section">
        <p>
          <Link href={`/ventures/${ctx.ventureId}/quotations`}>Back to quotations</Link>
        </p>
        <p className="ids-caption text-muted" role="status">
          {deliveryCopy(delivery, current?.status, customerDeliveries)}
        </p>
        {!current ? (
          <p className="ids-caption text-danger" role="alert">
            The current version is missing, so this quotation cannot be reviewed.
          </p>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-lg font-medium">Quotation identity</h2>
              <dl className="grid gap-2 text-sm">
                <div><dt className="text-muted">Customer</dt><dd>{customerName}</dd></div>
                <div><dt className="text-muted">Site</dt><dd>{siteName}</dd></div>
                <div><dt className="text-muted">Quotation reference</dt><dd className="break-all">{quotation.id}</dd></div>
                <div><dt className="text-muted">Version</dt><dd>{current.version}</dd></div>
                <div><dt className="text-muted">Status</dt><dd>{current.status}</dd></div>
                <div><dt className="text-muted">Document hash</dt><dd className="break-all">{current.documentHash}</dd></div>
              </dl>
            </section>
            <section>
              <h2 className="mb-3 text-lg font-medium">Current version {current.version}</h2>
              <CommercialReview version={current} />
              <p className="ids-caption mt-3 text-muted">{decisionCopy(quotation, current, customerDeliveries)}</p>
            </section>
            {ctx.canWrite && current.status === "in_preparation" ? (
              <section>
                <h2 className="mb-3 text-lg font-medium">Correct draft</h2>
                <CorrectQuotationForm
                  workspaceId={ctx.workspaceId}
                  ventureId={ctx.ventureId}
                  quotationId={quotation.id}
                  version={current}
                />
                <div className="mt-6">
                  <SendQuotationForm
                    workspaceId={ctx.workspaceId}
                    ventureId={ctx.ventureId}
                    quotationId={quotation.id}
                    version={current.version}
                  />
                </div>
              </section>
            ) : null}
            {ctx.canWrite && current.status !== "in_preparation" ? (
              <section>
                <h2 className="mb-3 text-lg font-medium">Revise</h2>
                <ReviseQuotationForm
                  workspaceId={ctx.workspaceId}
                  ventureId={ctx.ventureId}
                  quotationId={quotation.id}
                  version={current}
                />
              </section>
            ) : null}
            {current.status === "awaiting_customer_approval" ? (
              <section>
                <h2 className="mb-3 text-lg font-medium">Customer contact</h2>
                <p className="ids-caption mb-3 text-muted">
                  Mailbox verification, supervised verification, designation, and the test link are separate controls.
                </p>
                {contacts.length === 0 ? (
                  <p className="ids-caption mb-3 text-muted">No contact has been recorded for this site.</p>
                ) : (
                  <ul className="mb-4 space-y-4">
                    {contacts.map((contact) => {
                      const currentVerification = contact.supervisedVerifications.find((verification) => verification.revokedAt == null);
                      const designationActive = contact.designation != null && contact.designation.revokedAt == null;
                      return (
                        <li key={contact.id} className="grid gap-3 border-t border-border pt-3">
                          <p>
                            {contact.displayName} · {contact.email} · {contact.status}
                          </p>
                          <p className="ids-caption text-muted">
                            Mailbox verification: {contact.emailVerifiedAt ? `verified ${contact.emailVerifiedAt}` : "not verified"}.
                            {" "}Supervised verification: {currentVerification ? `${currentVerification.method} at ${currentVerification.verifiedAt}` : "none current"}.
                            {" "}Designation: {designationActive ? "authorised" : "not designated"}.
                          </p>
                          {contact.supervisedVerifications.length > 0 ? (
                            <ul className="ids-caption text-muted">
                              {contact.supervisedVerifications.map((verification) => (
                                <li key={verification.id}>
                                  {verification.method} recorded {verification.verifiedAt}
                                  {verification.revokedAt ? `, revoked ${verification.revokedAt}` : ", current"}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {ctx.canWrite && contact.status === "active" ? (
                            <div className="grid gap-4">
                              <CorrectQuotationContactForm
                                workspaceId={ctx.workspaceId}
                                ventureId={ctx.ventureId}
                                quotationId={quotation.id}
                                contactId={contact.id}
                                displayName={contact.displayName}
                                email={contact.email}
                              />
                              {currentVerification ? (
                                <RevokeSupervisedVerificationForm
                                  workspaceId={ctx.workspaceId}
                                  ventureId={ctx.ventureId}
                                  quotationId={quotation.id}
                                  contactId={contact.id}
                                />
                              ) : (
                                <RecordSupervisedVerificationForm
                                  workspaceId={ctx.workspaceId}
                                  ventureId={ctx.ventureId}
                                  quotationId={quotation.id}
                                  contactId={contact.id}
                                />
                              )}
                              {designationActive ? (
                                <RevokeQuotationDesignationForm
                                  workspaceId={ctx.workspaceId}
                                  ventureId={ctx.ventureId}
                                  quotationId={quotation.id}
                                  contactId={contact.id}
                                />
                              ) : (
                                <DesignateQuotationContactForm
                                  workspaceId={ctx.workspaceId}
                                  ventureId={ctx.ventureId}
                                  quotationId={quotation.id}
                                  contactId={contact.id}
                                />
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {ctx.canWrite ? (
                  <CreateQuotationContactForm
                    workspaceId={ctx.workspaceId}
                    ventureId={ctx.ventureId}
                    quotationId={quotation.id}
                  />
                ) : null}
              </section>
            ) : null}
            <section>
              <h2 className="mb-3 text-lg font-medium">Customer access</h2>
              <p className="ids-caption mb-3 text-muted">
                {QUOTATION_CUSTOMER_ACCESS_MODEL} A test decision link is not an email and does not mark the quotation delivered. Creating or revoking access uses the same office permission as changing a quotation. If the provider accepted the message, do not send it again. An uncertain send stays on the same delivery operation. Provider acceptance is not inbox delivery.
              </p>
              {accessGrants.length === 0 ? (
                <p className="ids-caption text-muted">No customer access grant has been created.</p>
              ) : (
                <ul className="mb-4 space-y-3">
                  {accessGrants.map((grant) => (
                    <li key={grant.id} className="grid gap-2">
                      <p>
                        Version {grant.version} is {accessLabel(grant.state, grant.decision)}. Bound to hash {grant.documentHash}. Expires {grant.expiresAt}.
                      </p>
                      {ctx.canWrite && grant.state === "active" ? (
                        <RevokeCustomerAccessForm
                          workspaceId={ctx.workspaceId}
                          ventureId={ctx.ventureId}
                          quotationId={quotation.id}
                          grantId={grant.id}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {ctx.canWrite && current.status === "awaiting_customer_approval" ? (
                <ActivateCustomerAccessForm
                  workspaceId={ctx.workspaceId}
                  ventureId={ctx.ventureId}
                  quotationId={quotation.id}
                  version={current.version}
                />
              ) : null}
            </section>
          </>
        )}
        <section>
          <h2 className="mb-3 text-lg font-medium">Version history</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="ids-caption text-muted">
                  <th className="py-2 pr-4 font-medium">Version</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Hash</th>
                </tr>
              </thead>
              <tbody>
                {quotation.versions.map((version) => (
                  <tr key={version.version} className="border-t border-border">
                    <td className="py-3 pr-4">{version.version}</td>
                    <td className="py-3 pr-4">{version.status}</td>
                    <td className="py-3 pr-4">{money(version.totalMinor)}</td>
                    <td className="break-all py-3 pr-4">{version.documentHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-medium">Customer decisions</h2>
          {quotation.decisions.length === 0 ? (
            <p className="ids-caption text-muted">No customer decision has been recorded.</p>
          ) : (
            <ul className="space-y-2">
              {quotation.decisions.map((decision) => (
                <li key={decision.id}>
                  Version {decision.version} {decision.decision}. Bound to hash {decision.documentHash}. This does not create a work order.
                </li>
              ))}
            </ul>
          )}
        </section>
      </Stack>
    </PageFrame>
  );
}
