import Link from "next/link";
import { PageFrame } from "@/core";
import { Stack } from "@/core/layout";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import { TaxConfigurationForms } from "@/modules/frigora/app/forms/tax-configuration-form";
import {
  TAX_CONFIGURATION_SEND_BLOCKED,
  type TaxConfigurationRecord,
  type TaxConfigurationEventRecord,
  type TaxRuleRecord,
} from "@/modules/frigora/tax-configuration";

function statusLabel(configurations: readonly TaxConfigurationRecord[]) {
  const verified = configurations.filter((configuration) => configuration.status === "verified");
  if (verified.length > 1) return "conflicting";
  if (verified.length === 0) return "unverified";
  return verified[0]?.registrationState ?? "unverified";
}

export function TaxConfigurationScreen({
  ctx,
  rules,
  configurations,
  events,
  error,
}: {
  ctx: FrigoraOpsContext;
  rules: readonly TaxRuleRecord[];
  configurations: readonly TaxConfigurationRecord[];
  events: readonly TaxConfigurationEventRecord[];
  error?: string;
}) {
  const verified = configurations.filter((configuration) => configuration.status === "verified");
  const reference = rules.find((rule) => rule.id === "sars-za-vat-standard-15");
  const current = verified.length === 1 ? verified[0] : null;
  const blocker = !current
    ? verified.length > 1
      ? "Sending is blocked. More than one verified tax configuration is active. Revoke the one that should not apply."
      : TAX_CONFIGURATION_SEND_BLOCKED
    : current.registrationState === "not_registered"
      ? "Verified as not registered. A quotation that charges VAT cannot be sent."
      : current.registrationState === "registered"
        ? "Verified as registered. Sending still requires the quotation to match the approved rule and liability date."
        : TAX_CONFIGURATION_SEND_BLOCKED;

  return (
    <PageFrame
      page="Tax configuration"
      kicker="Frigora operations"
      title="Tax configuration"
      description="Public tax rules, this venture's registration status, and approval are separate facts."
      ventureId={ctx.ventureId}
    >
      <Stack gap="section">
        <p><Link href={`/ventures/${ctx.ventureId}/quotations`}>Back to quotations</Link></p>
        {error ? <p className="ids-caption text-danger" role="alert">{error}</p> : null}
        <p className="ids-caption text-muted" role="status">
          Current configuration: {statusLabel(configurations)}. {blocker}
        </p>
        <section>
          <h2 className="mb-3 text-lg font-medium">Public rule reference</h2>
          {reference ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="ids-caption text-muted">Status</dt><dd>{reference.status}</dd></div>
              <div><dt className="ids-caption text-muted">Rate</dt><dd>{reference.rateNumerator}/{reference.rateDenominator}</dd></div>
              <div><dt className="ids-caption text-muted">Effective</dt><dd>{reference.effectiveFrom}{reference.effectiveUntil ? ` until ${reference.effectiveUntil}` : ""}</dd></div>
              <div><dt className="ids-caption text-muted">Source</dt><dd><a href={reference.sourceUrl}>{reference.sourceTitle}</a></dd></div>
              <div className="sm:col-span-2"><dt className="ids-caption text-muted">Provenance</dt><dd>{reference.sourceNote}</dd></div>
            </dl>
          ) : (
            <p role="status">The SARS reference rule is not recorded yet.</p>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-medium">Venture configurations</h2>
          {configurations.length === 0 ? (
            <p>No venture tax configuration has been recorded. Sending stays blocked.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left">
                <thead>
                  <tr className="ids-caption text-muted">
                    <th className="py-2 pr-4 font-medium">Version</th>
                    <th className="py-2 pr-4 font-medium">State</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {configurations.map((configuration) => (
                    <tr key={configuration.id} className="border-t border-border">
                      <td className="py-3 pr-4">{configuration.version}</td>
                      <td className="py-3 pr-4">{configuration.registrationState}</td>
                      <td className="py-3 pr-4">{configuration.status}</td>
                      <td className="py-3 pr-4">{configuration.evidenceReference ?? "Missing"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-medium">Audit</h2>
          {events.length === 0 ? <p>No configuration changes have been recorded.</p> : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id}>{event.occurredAt} — {event.kind}. {event.summary}</li>
              ))}
            </ul>
          )}
        </section>
        {ctx.canWrite ? (
          <TaxConfigurationForms
            workspaceId={ctx.workspaceId}
            ventureId={ctx.ventureId}
            verifiedId={verified.length === 1 ? verified[0]?.id ?? null : null}
          />
        ) : (
          <p>You can review this configuration. Changing or verifying it requires permission to update this venture.</p>
        )}
      </Stack>
    </PageFrame>
  );
}
