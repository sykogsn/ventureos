import { TaxConfigurationScreen } from "@/modules/frigora/app/screens/tax-configuration-screen";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { getTaxPostureQuery } from "@/modules/frigora/queries";

export default async function FrigoraTaxConfigurationPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const posture = await getTaxPostureQuery(frigoraScope(ctx));
  return (
    <TaxConfigurationScreen
      ctx={ctx}
      rules={posture.record?.rules ?? []}
      configurations={posture.record?.configurations ?? []}
      events={posture.record?.events ?? []}
      error={posture.error}
    />
  );
}
