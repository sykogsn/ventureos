import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Cluster, Grid, ReadingRegion, Stack, StackList } from "@/core/layout";
import { knowledgeObjectHref, type DecisionKnowledgeObject } from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { CatalogueSearchForm } from "./components/catalogue-search-form";
import { StatusMark } from "./components/status-mark";

export function BrainDecisionsScreen({
  query,
  items,
}: {
  query: string;
  items: DecisionKnowledgeObject[];
}) {
  return (
    <BrainFrame
      page="Decisions"
      title="Decision register"
      description="Rulings the desk has already made. Each row is a Knowledge Object of type Decision."
    >
      <CatalogueSearchForm
        action="/brain/decisions"
        defaultValue={query}
        placeholder="Decision, owner, or reasoning"
      />
      {items.length === 0 ? (
        <EmptyCopy title="No decisions match">
          Search a title or identifier the register already holds.
        </EmptyCopy>
      ) : (
        <StackList>
          {items.map((item) => (
            <li key={item.id}>
              <Stack gap="compact">
                <Cluster justify="start">
                  <StatusMark>{item.status}</StatusMark>
                  <p className="ids-caption">{item.id}</p>
                  <p className="ids-caption">{item.impact}</p>
                </Cluster>
                <h2 className="ids-label text-foreground">{item.title}</h2>
                <Grid variant="pair">
                  <Stack gap="tight">
                    <p className="ids-kicker">Owner</p>
                    <p className="ids-body text-muted">{item.owner}</p>
                  </Stack>
                  <Stack gap="tight">
                    <p className="ids-kicker">Date</p>
                    <p className="ids-body text-muted">{item.issuedAt}</p>
                  </Stack>
                  <Stack gap="tight">
                    <p className="ids-kicker">Impact</p>
                    <p className="ids-body text-muted">{item.impact}</p>
                  </Stack>
                  <Stack gap="tight">
                    <p className="ids-kicker">Review date</p>
                    <p className="ids-body text-muted">{item.reviewDate}</p>
                  </Stack>
                </Grid>
                <Stack gap="tight">
                  <p className="ids-kicker">Reasoning</p>
                  <ReadingRegion size="lg">
                    <p className="ids-body text-muted">{item.purpose}</p>
                  </ReadingRegion>
                </Stack>
                <Stack gap="tight">
                  <p className="ids-kicker">Evidence</p>
                  <ReadingRegion size="lg">
                    <p className="ids-body text-muted">{item.evidence.join(" · ")}</p>
                  </ReadingRegion>
                </Stack>
                <Stack gap="tight">
                  <p className="ids-kicker">Alternatives considered</p>
                  <ReadingRegion size="lg">
                    <p className="ids-body text-muted">{item.alternatives.join(" · ")}</p>
                  </ReadingRegion>
                </Stack>
                <p className="ids-caption">
                  <Link
                    href={knowledgeObjectHref(item.id)}
                    className="ids-transition underline-offset-4 hover:underline"
                  >
                    Open as a Knowledge Object
                  </Link>
                </p>
              </Stack>
            </li>
          ))}
        </StackList>
      )}
    </BrainFrame>
  );
}
