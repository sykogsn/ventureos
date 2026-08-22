import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { companyHomeHref } from "@/modules/ventures/home";
import type { VentureRecord } from "@/modules/ventures/service";
import { Fit, ReadingRegion, Stack } from "@/core/layout";

export function VenturesScreen({ ventures }: { ventures: VentureRecord[] }) {
  return (
    <PageFrame
      page="Ventures"
      kicker="Portfolio"
      title="Ventures"
      description="Companies you operate from this workspace. Found another when you are ready to open a new Company HQ."
      actions={
        <Link href="/ventures/launch" className="vos-btn-primary">
          Found Company
        </Link>
      }
    >
      {ventures.length === 0 ? (
        <EmptyCopy
          title="No companies yet"
          action={
            <Fit>
              <Link href="/ventures/launch" className="vos-btn-primary">
                Found Company
              </Link>
            </Fit>
          }
        >
          Found a company to open Company HQ and start the daily brief.
        </EmptyCopy>
      ) : (
        <ReadingRegion size="md">
          <Stack gap="tight">
            {ventures.map((venture) => (
              <Link
                key={venture.id}
                href={companyHomeHref(venture.slug)}
                className="vos-list-item"
              >
                {venture.name}
              </Link>
            ))}
          </Stack>
        </ReadingRegion>
      )}
    </PageFrame>
  );
}
