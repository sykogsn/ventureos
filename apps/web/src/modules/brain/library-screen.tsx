import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Cluster, ReadingRegion, Stack, StackList } from "@/core/layout";
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
        <StackList>
          {items.map((item) => (
            <li key={item.id}>
              <Stack gap="tight">
                <Cluster justify="start">
                  <StatusMark>{item.status}</StatusMark>
                  <p className="ids-caption">{item.type}</p>
                  <p className="ids-caption">{item.owner}</p>
                  <p className="ids-caption">{item.scopes.join(" · ")}</p>
                </Cluster>
                <Link
                  href={`/brain/library/${item.id}`}
                  className="ids-label ids-transition underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
                <ReadingRegion size="lg">
                  <p className="ids-body text-muted">{item.summary}</p>
                </ReadingRegion>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </BrainFrame>
  );
}
