import { CustomersScreen } from "@/modules/frigora/app/screens/customers-screen";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { listCustomersQuery } from "@/modules/frigora/queries";

export default async function FrigoraCustomersPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const result = await listCustomersQuery(frigoraScope(ctx));

  return (
    <CustomersScreen
      ctx={ctx}
      customers={result.record ?? []}
      error={result.error}
    />
  );
}
