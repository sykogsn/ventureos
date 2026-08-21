import type { Metadata } from "next";
import { BrainSearchScreen } from "@/modules/brain";
import {
  parseSearchQuery,
  previewCatalogue,
  recentSearches,
  searchBrain,
  suggestedSearches,
} from "@/platform/brain";

export const metadata: Metadata = {
  title: "Brain search",
};

export default async function BrainSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = parseSearchQuery((await searchParams).q);
  const hits = query ? searchBrain(query) : previewCatalogue();

  return (
    <BrainSearchScreen
      query={query}
      recent={recentSearches}
      suggested={suggestedSearches}
      hits={hits}
    />
  );
}
