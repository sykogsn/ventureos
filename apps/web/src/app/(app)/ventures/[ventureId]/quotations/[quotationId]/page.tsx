import { notFound } from "next/navigation";
import type { UserId } from "@/contracts";
import { QuotationDetailScreen } from "@/modules/frigora/app/screens/quotation-detail-screen";
import { frigoraScope, requireFrigoraOfficeContext } from "@/modules/frigora/app/context";
import { getQuotationQuery } from "@/modules/frigora/queries";
import { createScope, getFrigoraService } from "@/modules/frigora/service";
import type { FrigoraQuotationId } from "@/modules/frigora/types";

export default async function FrigoraQuotationPage({
  params,
}: {
  params: Promise<{ ventureId: string; quotationId: string }>;
}) {
  const { ventureId, quotationId } = await params;
  const ctx = await requireFrigoraOfficeContext(ventureId);
  const result = await getQuotationQuery({ ...frigoraScope(ctx), quotationId });
  if (result.error || !result.record) {
    notFound();
  }

  const scope = createScope({
    userId: ctx.sessionUserId as UserId,
    workspaceId: ctx.workspaceId,
    ventureId: ctx.ventureId,
  });
  const service = getFrigoraService();
  const delivery = await service.getQuotationDelivery(scope, quotationId as FrigoraQuotationId);
  const customerDeliveries = await service.listQuotationCustomerDeliveries(scope, quotationId as FrigoraQuotationId);
  const accessGrants = await service.listQuotationCustomerAccess(scope, quotationId as FrigoraQuotationId);
  const contacts = await service.listQuotationCustomerContacts(scope, quotationId as FrigoraQuotationId);
  const customer = await service.getCustomer(scope, result.record.customerId);
  const site = await service.getSite(scope, result.record.siteId);

  return (
    <QuotationDetailScreen
      ctx={ctx}
      quotation={result.record}
      delivery={delivery}
      customerDeliveries={customerDeliveries}
      accessGrants={accessGrants}
      contacts={contacts}
      customerName={customer?.displayName ?? result.record.customerId}
      siteName={site?.name ?? result.record.siteId}
    />
  );
}
