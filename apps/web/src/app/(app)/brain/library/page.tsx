import type { Metadata } from "next";
import { BrainLibraryScreen } from "@/modules/brain";
import { filterKnowledge, parseKnowledgeFilter } from "@/platform/brain";

export const metadata: Metadata = {
  title: "Knowledge library",
};

export default async function BrainLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string | string[];
    owner?: string | string[];
    status?: string | string[];
    venture?: string | string[];
    q?: string | string[];
  }>;
}) {
  const filter = parseKnowledgeFilter(await searchParams);
  return <BrainLibraryScreen filter={filter} items={filterKnowledge(filter)} />;
}
