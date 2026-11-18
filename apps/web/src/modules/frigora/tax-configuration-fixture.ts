import type { FrigoraScope } from "./types";

export const SYNTHETIC_NOT_REGISTERED_EVIDENCE = "synthetic-fixture:not-a-live-vat-registration";

type TaxSendFixture = {
  getTaxPosture(scope: FrigoraScope): Promise<{ configurations: readonly { status: string }[] }>;
  verifyTaxConfiguration(scope: FrigoraScope, input: {
    jurisdiction: "ZA";
    registrationState: "not_registered";
    evidenceReference: string;
  }): Promise<unknown>;
};

/** Test-only. Does not run at startup and does not verify a live venture by itself. */
export async function allowSyntheticNotRegisteredQuotationSend(
  service: TaxSendFixture,
  scope: FrigoraScope,
) {
  const posture = await service.getTaxPosture(scope);
  if (posture.configurations.some((configuration) => configuration.status === "verified")) {
    return;
  }
  await service.verifyTaxConfiguration(scope, {
    jurisdiction: "ZA",
    registrationState: "not_registered",
    evidenceReference: SYNTHETIC_NOT_REGISTERED_EVIDENCE,
  });
}
