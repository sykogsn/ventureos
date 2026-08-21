import { ExecutiveCard } from "./components/executive-card";
import { formatBriefingDate } from "./format";
import type { ExecutiveFloorModel } from "./types";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { PageFrame } from "@/core";
import Link from "next/link";

export function ExecutiveOfficeFloorScreen({
  data,
  basePath = "/agents",
  now = new Date(),
}: {
  data: ExecutiveFloorModel;
  basePath?: string;
  now?: Date;
}) {
  return (
    <PageFrame
      page="Executive Office"
      kicker="Leadership floor"
      title="Executive Office"
      lede={data.posture}
      description={data.worldLine}
      meta={formatBriefingDate(now)}
    >
      {data.executives.length === 0 ? (
        <EmptyCopy
          title="This floor is unseated"
          action={
            <Link href="/dashboard" className="vos-btn-primary w-fit">
              Return to the Situation Room
            </Link>
          }
        >
          No seated desks are on this floor. Situation Room and Company HQ remain the operating
          surfaces.
        </EmptyCopy>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          {data.executives.map((executive) => (
            <ExecutiveCard
              key={executive.id}
              executive={executive}
              basePath={basePath}
            />
          ))}
        </div>
      )}
    </PageFrame>
  );
}
