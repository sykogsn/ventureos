import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Grid, ReadingRegion, Stack, StackList } from "@/core/layout";
import type { BrainSearchHit } from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { CatalogueSearchForm } from "./components/catalogue-search-form";

export function BrainSearchScreen({
  query,
  recent,
  suggested,
  hits,
}: {
  query: string;
  recent: string[];
  suggested: string[];
  hits: BrainSearchHit[];
}) {
  return (
    <BrainFrame
      page="Search"
      title="Search"
      description="Find Knowledge Objects already in the catalogue. This is a title match, not a semantic index."
    >
      <CatalogueSearchForm
        action="/brain/search"
        defaultValue={query}
        placeholder="Runtime, Calviora, IDS"
      />

      <Grid variant="pair">
        <Stack gap="compact">
          <h2 className="ids-kicker">Recent searches</h2>
          <Stack gap="tight">
            {recent.map((term) => (
              <Link
                key={term}
                href={`/brain/search?q=${encodeURIComponent(term)}`}
                className="ids-body ids-transition text-muted underline-offset-4 hover:underline"
              >
                {term}
              </Link>
            ))}
          </Stack>
        </Stack>
        <Stack gap="compact">
          <h2 className="ids-kicker">Suggested searches</h2>
          <Stack gap="tight">
            {suggested.map((term) => (
              <Link
                key={term}
                href={`/brain/search?q=${encodeURIComponent(term)}`}
                className="ids-body ids-transition text-muted underline-offset-4 hover:underline"
              >
                {term}
              </Link>
            ))}
          </Stack>
        </Stack>
      </Grid>

      <Stack gap="compact">
        <h2 className="ids-kicker">{query ? "Results" : "From the catalogue"}</h2>
        {hits.length === 0 ? (
          <EmptyCopy title="Nothing matched">
            Try a suggested search. Brain v0.1 matches words in titles and summaries only.
          </EmptyCopy>
        ) : (
          <StackList>
            {hits.map((hit) => (
              <li key={hit.id}>
                <Stack gap="tight">
                  <p className="ids-caption">{hit.type}</p>
                  <Link
                    href={hit.href}
                    className="ids-label ids-transition underline-offset-4 hover:underline"
                  >
                    {hit.title}
                  </Link>
                  <ReadingRegion size="lg">
                    <p className="ids-body text-muted">{hit.summary}</p>
                  </ReadingRegion>
                </Stack>
              </li>
            ))}
          </StackList>
        )}
      </Stack>
    </BrainFrame>
  );
}
