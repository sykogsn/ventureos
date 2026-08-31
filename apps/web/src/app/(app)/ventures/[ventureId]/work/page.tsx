import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import { WorkListScreen } from "@/modules/frigora/app/screens/work-screens";
import { loadWorkOrderList, type WorkListFilters } from "@/modules/frigora/app/views";
import type { FrigoraWorkOrderStatus } from "@/modules/frigora/types";

function parseWorkListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): WorkListFilters {
  const statusRaw = typeof searchParams.status === "string" ? searchParams.status : "all";
  const assignmentRaw =
    typeof searchParams.assignment === "string" ? searchParams.assignment : "all";

  const status: WorkListFilters["status"] =
    statusRaw === "open" || statusRaw === "closed" || statusRaw === "cancelled"
      ? (statusRaw as FrigoraWorkOrderStatus)
      : "all";

  const assignment: WorkListFilters["assignment"] =
    assignmentRaw === "assigned" || assignmentRaw === "unassigned"
      ? assignmentRaw
      : "all";

  return { status, assignment };
}

export default async function FrigoraWorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ ventureId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ventureId } = await params;
  const query = await searchParams;
  const ctx = await requireFrigoraOpsContext(ventureId);
  const filters = parseWorkListFilters(query);
  const { rows, error } = await loadWorkOrderList(frigoraScope(ctx), filters);

  return <WorkListScreen ctx={ctx} rows={rows} filters={filters} error={error} />;
}
