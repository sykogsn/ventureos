import { CrmScreen } from "@/modules/crm";

export default async function VentureCrmPage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;

  return <CrmScreen ventureId={ventureId} />;
}
