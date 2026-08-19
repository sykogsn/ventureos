import { ExecutiveCard } from "./components/executive-card";
import { FloorHeader } from "./components/floor-header";
import { formatBriefingDate } from "./format";
import type { ExecutiveFloorModel } from "./types";
import { EmptyCopy } from "@/core/shell/empty-copy";

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
    <section className="flex min-h-full flex-1 flex-col">
      <div className="vos-screen mx-auto flex w-full max-w-[1040px] flex-1 flex-col gap-8">
        <FloorHeader
          dateLabel={formatBriefingDate(now)}
          posture={data.posture}
          worldLine={data.worldLine}
        />
        {data.executives.length === 0 ? (
          <EmptyCopy title="This floor is unseated">
            This company does not use an Executive Office. Situation Room and Company HQ remain the
            operating surfaces.
          </EmptyCopy>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.executives.map((executive) => (
              <ExecutiveCard
                key={executive.id}
                executive={executive}
                basePath={basePath}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
