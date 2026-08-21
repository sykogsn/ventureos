import type { Metadata } from "next";
import { BrainDecisionsScreen } from "@/modules/brain";
import { filterDecisions, parseSearchQuery } from "@/platform/brain";

export const metadata: Metadata = {
  title: "Decision register",
};

export default async function BrainDecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = parseSearchQuery((await searchParams).q);
  return <BrainDecisionsScreen query={query} items={filterDecisions(query)} />;
}
