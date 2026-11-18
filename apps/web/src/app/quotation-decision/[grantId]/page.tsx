import type { Metadata } from "next";
import { CustomerQuotationDecision } from "@/modules/frigora/customer-quotation-decision";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Quotation decision" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function QuotationDecisionPage({
  params,
}: {
  params: Promise<{ grantId: string }>;
}) {
  const { grantId } = await params;
  return <CustomerQuotationDecision grantId={grantId} />;
}
