import Link from "next/link";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import type { StoryHighlight } from "../types";
import { Fit, ReadingRegion, Stack, StackList } from "@/core/layout";

export function CompanyStoryHighlights({
  stories,
}: {
  stories: StoryHighlight[];
}) {
  return (
    <SectionCard>
      <Stack gap="tight">
        <p className="ids-kicker">Company story highlights</p>
        <p className="ids-caption">The narrative each company is living this week.</p>
      </Stack>
      {stories.length === 0 ? (
        <EmptyCopy
          title="No activity"
          action={
            <Fit>
              <Link href="/ventures/launch" className="vos-btn-primary">
                Found Company
              </Link>
            </Fit>
          }
        >
          Company narrative is written at founding. Open the wizard when you are ready to start.
        </EmptyCopy>
      ) : (
        <StackList as="div">
          {stories.map((story) => (
            <article key={story.id}>
              <Stack gap="compact">
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
                <ReadingRegion size="lg">
                  <Stack gap="compact">
                    <p className="ids-body text-foreground">{story.excerpt}</p>
                    <p className="ids-body italic text-muted">{story.tension}</p>
                  </Stack>
                </ReadingRegion>
              </Stack>
            </article>
          ))}
        </StackList>
      )}
    </SectionCard>
  );
}
