import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { KnowledgeFilter, KnowledgeObject } from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { KnowledgeFilterForm } from "./components/knowledge-filter-form";
import { StatusMark } from "./components/status-mark";

export function BrainLibraryScreen({
  filter,
  items,
}: {
  filter: KnowledgeFilter;
  items: KnowledgeObject[];
}) {
  return (
    <BrainFrame
      page="Library"
      title="Knowledge library"
      description="Every record is a Knowledge Object. Filter the catalogue. Do not treat this as a file cabinet."
    >
      <KnowledgeFilterForm filter={filter} />
      {items.length === 0 ? (
        <EmptyCopy title="No objects match">
          Clear the filters or search a title the catalogue already holds.
        </EmptyCopy>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-t border-border py-5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-3">
                <StatusMark>{item.status}</StatusMark>
                <p className="ids-caption">{item.type}</p>
                <p className="ids-caption">{item.owner}</p>
                <p className="ids-caption">{item.scopes.join(" · ")}</p>
              </div>
              <Link
                href={`/brain/library/${item.id}`}
                className="ids-label mt-2 block ids-transition underline-offset-4 hover:underline"
              >
                {item.title}
              </Link>
              <p className="ids-body mt-2 max-w-[42rem] text-muted">{item.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </BrainFrame>
  );
}
