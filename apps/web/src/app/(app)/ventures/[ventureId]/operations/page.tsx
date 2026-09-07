import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { OperationsScreen } from "@/modules/frigora/app/screens/operations-screen";
import { loadOperationsOverview } from "@/modules/frigora/app/views";

export default async function FrigoraOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ventureId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { ventureId } = await params;
  const requestedDate = (await searchParams).date;
  const today = new Date().toISOString().slice(0, 10);
  const requestedDateMs = requestedDate
    ? Date.parse(`${requestedDate}T00:00:00.000Z`)
    : Number.NaN;
  const date =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    !Number.isNaN(requestedDateMs) &&
    new Date(requestedDateMs).toISOString().slice(0, 10) === requestedDate
      ? requestedDate
      : today;
  const start = `${date}T00:00:00.000Z`;
  const end = new Date(Date.parse(start) + 86_400_000).toISOString();
  const ctx = await requireFrigoraOpsContext(ventureId);
  const { view, error } = await loadOperationsOverview(frigoraScope(ctx), {
    date,
    start,
    end,
  });

  return <OperationsScreen ctx={ctx} view={view} error={error} />;
}
