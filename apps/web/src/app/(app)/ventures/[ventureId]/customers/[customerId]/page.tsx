import { notFound } from "next/navigation";
import { Stack } from "@/core/layout";
import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { CreateSiteForm } from "@/modules/frigora/app/forms/create-site-form";
import { CustomerDetailScreen } from "@/modules/frigora/app/screens/customers-screen";
import { getCustomerQuery, listSitesByCustomerQuery } from "@/modules/frigora/queries";

export default async function FrigoraCustomerDetailPage({
  params,
}: {
  params: Promise<{ ventureId: string; customerId: string }>;
}) {
  const { ventureId, customerId } = await params;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const scope = frigoraScope(ctx);

  const customerResult = await getCustomerQuery({ ...scope, id: customerId });
  if (customerResult.error) {
    return (
      <p className="ids-caption text-danger" role="alert">
        {customerResult.error}
      </p>
    );
  }
  if (!customerResult.record) {
    notFound();
  }

  const sitesResult = await listSitesByCustomerQuery({
    ...scope,
    customerId,
  });

  return (
    <CustomerDetailScreen
      ctx={ctx}
      customer={customerResult.record}
      sites={sitesResult.record ?? []}
      createSiteSlot={
        ctx.canWrite ? (
          <Stack gap="compact">
            <h2 className="ids-label text-foreground">Create site</h2>
            <CreateSiteForm
              workspaceId={ctx.workspaceId}
              ventureId={ctx.ventureId}
              customerId={customerResult.record.id}
            />
          </Stack>
        ) : (
          <p className="ids-caption text-muted">
            Creating sites requires venture update permission.
          </p>
        )
      }
    />
  );
}
