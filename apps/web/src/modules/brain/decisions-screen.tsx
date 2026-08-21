import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
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
        <ul className="flex flex-col">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-t border-border py-6 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-3">
                <StatusMark>{item.status}</StatusMark>
                <p className="ids-caption">{item.id}</p>
                <p className="ids-caption">{item.impact}</p>
              </div>
              <h2 className="ids-label mt-3 text-foreground">{item.title}</h2>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <dt className="ids-kicker">Owner</dt>
                  <dd className="ids-body mt-1 text-muted">{item.owner}</dd>
                </div>
                <div>
                  <dt className="ids-kicker">Date</dt>
                  <dd className="ids-body mt-1 text-muted">{item.issuedAt}</dd>
                </div>
                <div>
                  <dt className="ids-kicker">Impact</dt>
                  <dd className="ids-body mt-1 text-muted">{item.impact}</dd>
                </div>
                <div>
                  <dt className="ids-kicker">Review date</dt>
                  <dd className="ids-body mt-1 text-muted">{item.reviewDate}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="ids-kicker">Reasoning</dt>
                  <dd className="ids-body mt-1 max-w-[42rem] text-muted">{item.purpose}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="ids-kicker">Evidence</dt>
                  <dd className="ids-body mt-1 max-w-[42rem] text-muted">{item.evidence.join(" · ")}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="ids-kicker">Alternatives considered</dt>
                  <dd className="ids-body mt-1 max-w-[42rem] text-muted">
                    {item.alternatives.join(" · ")}
                  </dd>
                </div>
              </dl>
              <p className="ids-caption mt-4">
                <Link
                  href={knowledgeObjectHref(item.id)}
                  className="ids-transition underline-offset-4 hover:underline"
                >
                  Open as a Knowledge Object
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </BrainFrame>
  );
}
