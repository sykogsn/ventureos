import Link from "next/link";
import {
  knowledgeObjectHref,
  resolveRelationships,
  type KnowledgeObject,
  knowledgeObjects,
} from "@/platform/brain";
import { StatusMark } from "./status-mark";

function Block({ title, children }: { title: string; children: string | string[] }) {
  const body = Array.isArray(children) ? children : [children];
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-8">
      <h2 className="ids-kicker">{title}</h2>
      {body.length === 0 ? (
        <p className="ids-body text-muted">None recorded in this catalogue.</p>
      ) : (
        body.map((line) => (
          <p key={line} className="ids-body max-w-[42rem] text-muted">
            {line}
          </p>
        ))
      )}
    </section>
  );
}

export function KnowledgeObjectLayout({
  object,
  showTitle = true,
}: {
  object: KnowledgeObject;
  showTitle?: boolean;
}) {
  const related = resolveRelationships(object, knowledgeObjects);

  return (
    <article className="flex flex-col">
      {showTitle ? <h2 className="ids-display">{object.title}</h2> : null}
      <div className="flex flex-wrap items-center gap-3">
        <StatusMark>{object.status}</StatusMark>
        <p className="ids-caption">{object.type}</p>
        <p className="ids-caption">{object.version}</p>
      </div>

      <Block title="Summary">{object.summary}</Block>
      <Block title="Purpose">{object.purpose}</Block>
      <Block title="Why">{object.why}</Block>
      <Block title="Evidence">{object.evidence}</Block>
      <section className="flex flex-col gap-3 border-t border-border pt-8">
        <h2 className="ids-kicker">Relationships</h2>
        {related.length === 0 ? (
          <p className="ids-body text-muted">No linked objects in this catalogue.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {related.map((item) => (
              <li key={item.objectId} className="ids-body text-muted">
                {item.object ? (
                  <Link
                    href={knowledgeObjectHref(item.object.id)}
                    className="ids-transition underline-offset-4 hover:underline"
                  >
                    {item.object.title}
                  </Link>
                ) : (
                  item.objectId
                )}
                {item.object ? <span className="ids-caption ml-2">{item.object.type}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3 border-t border-border pt-8">
        <h2 className="ids-kicker">History</h2>
        <ul className="flex flex-col gap-3">
          {object.history.map((entry) => (
            <li key={`${entry.at}-${entry.note}`} className="ids-body max-w-[42rem] text-muted">
              <span className="ids-caption text-foreground">{entry.at}</span>
              <span className="mx-2 text-border">·</span>
              {entry.note}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3 border-t border-border pt-8">
        <h2 className="ids-kicker">Owner</h2>
        <p className="ids-body text-muted">{object.owner}</p>
      </section>
      <section className="flex flex-col gap-3 border-t border-border pt-8">
        <h2 className="ids-kicker">Status</h2>
        <p className="ids-body text-muted">{object.status}</p>
      </section>
      <section className="flex flex-col gap-3 border-t border-border pt-8">
        <h2 className="ids-kicker">Review date</h2>
        <p className="ids-body text-muted">{object.reviewDate}</p>
        <p className="ids-caption">Last review · {object.lastReview}</p>
      </section>
      <Block title="AI context">{object.aiContext}</Block>
    </article>
  );
}
