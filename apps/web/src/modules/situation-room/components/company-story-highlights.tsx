import Link from "next/link";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { StoryHighlight } from "../types";

export function CompanyStoryHighlights({
  stories,
}: {
  stories: StoryHighlight[];
}) {
  return (
    <SectionCard>
      <div>
        <p className="ids-kicker">Company story highlights</p>
        <p className="ids-caption mt-1">
          The narrative each company is living this week.
        </p>
      </div>
      {stories.length === 0 ? (
        <EmptyCopy
          title="No activity"
          action={
            <Link href="/ventures/launch" className="vos-btn-primary w-fit">
              Found Company
            </Link>
          }
        >
          Company narrative is written at founding. Open the wizard when you are ready to start.
        </EmptyCopy>
      ) : (
      <div className="flex flex-col gap-6">
        {stories.map((story) => (
          <article
            key={story.id}
            className="border-t border-border pt-5 first:border-t-0 first:pt-0"
          >
            <p className="ids-caption">
              <Link
                href={story.companyHref}
                className="ids-transition underline-offset-4 hover:underline"
              >
                {story.company}
              </Link>
              {" · "}
              {story.chapter}
            </p>
            <p className="ids-body mt-3 max-w-[42rem] text-foreground">
              {story.excerpt}
            </p>
            <p className="ids-body mt-3 max-w-[42rem] italic text-muted">
              {story.tension}
            </p>
          </article>
        ))}
      </div>
      )}
    </SectionCard>
  );
}
