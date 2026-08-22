import type { Metadata } from "next";
import {
  EngineeringSprintsScreen,
  loadEngineeringIntelligence,
} from "@/modules/engineering-hq";
import { filterTimeline } from "@/modules/engineering-hq/intelligence/timeline";

export const metadata: Metadata = {
  title: "Sprint Centre",
};

export default async function EngineeringSprintsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = (await searchParams).q ?? "";
  const { catalogue, intelligence } = loadEngineeringIntelligence();
  return (
    <EngineeringSprintsScreen
      catalogue={catalogue}
      intelligence={intelligence}
      query={query}
      timeline={filterTimeline(intelligence.timeline, query)}
    />
  );
}
