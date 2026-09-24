import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { projectSituationRoom } from "@/core/venture";
import {
  adaptExecutiveWorkspace,
  ExecutiveWorkspaceScreen,
} from "@/modules/executive-workspace";
import { loadActiveIntelligence } from "@/modules/intelligence/request";
import { FounderWelcome } from "@/modules/situation-room/welcome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Executive Workspace",
};

export default async function DashboardPage() {
  const active = await loadActiveIntelligence();
  if (!active) {
    redirect("/login");
  }

  if (active.core.ventures.length === 0) {
    return <FounderWelcome founderName={active.core.founder.name} />;
  }

  const room = projectSituationRoom(active.core);
  const model = adaptExecutiveWorkspace({
    room,
    recommendations: active.core.recommendations.items,
  });

  return <ExecutiveWorkspaceScreen model={model} />;
}
