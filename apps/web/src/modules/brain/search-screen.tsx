import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
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

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="ids-kicker">Recent searches</h2>
          <ul className="flex flex-col gap-2">
            {recent.map((term) => (
              <li key={term}>
                <Link
                  href={`/brain/search?q=${encodeURIComponent(term)}`}
                  className="ids-body ids-transition text-muted underline-offset-4 hover:underline"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="ids-kicker">Suggested searches</h2>
          <ul className="flex flex-col gap-2">
            {suggested.map((term) => (
              <li key={term}>
                <Link
                  href={`/brain/search?q=${encodeURIComponent(term)}`}
                  className="ids-body ids-transition text-muted underline-offset-4 hover:underline"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="ids-kicker">{query ? "Results" : "From the catalogue"}</h2>
        {hits.length === 0 ? (
          <EmptyCopy title="Nothing matched">
            Try a suggested search. Brain v0.1 matches words in titles and summaries only.
          </EmptyCopy>
        ) : (
          <ul className="flex flex-col">
            {hits.map((hit) => (
              <li
                key={hit.id}
                className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <p className="ids-caption">{hit.type}</p>
                <Link
                  href={hit.href}
                  className="ids-label mt-2 block ids-transition underline-offset-4 hover:underline"
                >
                  {hit.title}
                </Link>
                <p className="ids-body mt-2 max-w-[42rem] text-muted">{hit.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainFrame>
  );
}
