import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Fit } from "@/core/layout";

export function DeferredOperatingScreen({
  title,
  ventureId,
  summary,
}: {
  title: string;
  ventureId: string;
  summary: string;
}) {
  return (
    <PageFrame
      page={title}
      kicker="Reserved surface"
      title={title}
      description={summary}
      ventureId={ventureId}
    >
      <EmptyCopy
        title={`${title} is not live in Foundation`}
        action={
          <Fit>
            <Link href={`/ventures/${ventureId}`} className="vos-btn-primary">
              Open Company HQ
            </Link>
          </Fit>
        }
      >
        Company HQ remains the operating record. This route is reserved so the desk does not grow a
        second system.
      </EmptyCopy>
    </PageFrame>
  );
}
