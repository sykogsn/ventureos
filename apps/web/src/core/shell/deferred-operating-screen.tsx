import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";

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
    <PageFrame title={title} ventureId={ventureId}>
      <div className="flex max-w-xl flex-col gap-4">
        <EmptyCopy>{summary}</EmptyCopy>
        <Link href={`/ventures/${ventureId}`} className="vos-btn-primary w-fit">
          Open Company HQ
        </Link>
      </div>
    </PageFrame>
  );
}
