import Link from "next/link";
import {
  knowledgeObjectHref,
  resolveRelationships,
  type KnowledgeObject,
  knowledgeObjects,
} from "@/platform/brain";
import { Cluster, Hairline, ReadingRegion, Stack } from "@/core/layout";
import { StatusMark } from "./status-mark";

function Block({ title, children }: { title: string; children: string | string[] }) {
  const body = Array.isArray(children) ? children : [children];
  return (
    <Hairline space="section">
      <Stack gap="compact">
        <h2 className="ids-kicker">{title}</h2>
        {body.length === 0 ? (
          <p className="ids-body text-muted">None recorded in this catalogue.</p>
        ) : (
          body.map((line) => (
            <ReadingRegion key={line} size="lg">
              <p className="ids-body text-muted">{line}</p>
            </ReadingRegion>
          ))
        )}
      </Stack>
    </Hairline>
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
    <article>
      <Stack gap="tight">
        {showTitle ? <h2 className="ids-display">{object.title}</h2> : null}
        <Cluster justify="start">
          <StatusMark>{object.status}</StatusMark>
          <p className="ids-caption">{object.type}</p>
          <p className="ids-caption">{object.version}</p>
        </Cluster>
      </Stack>

      <Block title="Summary">{object.summary}</Block>
      <Block title="Purpose">{object.purpose}</Block>
      <Block title="Why">{object.why}</Block>
      <Block title="Evidence">{object.evidence}</Block>
      <Hairline space="section">
        <Stack gap="compact">
          <h2 className="ids-kicker">Relationships</h2>
          {related.length === 0 ? (
            <p className="ids-body text-muted">No linked objects in this catalogue.</p>
          ) : (
            <Stack gap="tight">
              {related.map((item) => (
                <div key={item.objectId} className="ids-body text-muted">
                  {item.object ? (
                    <Cluster justify="start">
                      <Link
                        href={knowledgeObjectHref(item.object.id)}
                        className="ids-transition underline-offset-4 hover:underline"
                      >
                        {item.object.title}
                      </Link>
                      <span className="ids-caption">{item.object.type}</span>
                    </Cluster>
                  ) : (
                    item.objectId
                  )}
                </div>
              ))}
            </Stack>
          )}
        </Stack>
      </Hairline>
      <Hairline space="section">
        <Stack gap="compact">
          <h2 className="ids-kicker">History</h2>
          <Stack gap="compact">
            {object.history.map((entry) => (
              <ReadingRegion key={`${entry.at}-${entry.note}`} size="lg">
                <p className="ids-body text-muted">
                  <span className="ids-caption text-foreground">{entry.at}</span>
                  {" · "}
                  {entry.note}
                </p>
              </ReadingRegion>
            ))}
          </Stack>
        </Stack>
      </Hairline>
      <Hairline space="section">
        <Stack gap="compact">
          <h2 className="ids-kicker">Owner</h2>
          <p className="ids-body text-muted">{object.owner}</p>
        </Stack>
      </Hairline>
      <Hairline space="section">
        <Stack gap="compact">
          <h2 className="ids-kicker">Status</h2>
          <p className="ids-body text-muted">{object.status}</p>
        </Stack>
      </Hairline>
      <Hairline space="section">
        <Stack gap="compact">
          <h2 className="ids-kicker">Review date</h2>
          <p className="ids-body text-muted">{object.reviewDate}</p>
          <p className="ids-caption">Last review · {object.lastReview}</p>
        </Stack>
      </Hairline>
      <Block title="AI context">{object.aiContext}</Block>
    </article>
  );
}
