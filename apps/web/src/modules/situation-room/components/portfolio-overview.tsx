import Link from "next/link";
import { cn } from "@/utils/cn";
import { HealthPill } from "@/modules/dashboard/components/pills";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { attentionLabel } from "../format";
import type { PortfolioCompany } from "../types";
import { Cluster, Fit, Ledger, Stack } from "@/core/layout";

export function PortfolioOverview({
  companies,
}: {
  companies: PortfolioCompany[];
}) {
  return (
    <SectionCard>
      <Cluster justify="between">
        <Stack gap="tight">
          <p className="ids-kicker">Portfolio overview</p>
          <p className="ids-caption">Where attention belongs — not a scoreboard.</p>
        </Stack>
        <Link href="/ventures" className="ids-caption vos-link">
          All companies
        </Link>
      </Cluster>
      {companies.length === 0 ? (
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
          Found a company and it will take its place here — as operating judgement, not a
          scoreboard.
        </EmptyCopy>
      ) : (
        <Ledger>
          {companies.map((company) => (
            <li
              key={company.id}
              className={cn(company.attention === "hold" && "opacity-70")}
            >
              <Cluster justify="start">
                <Link
                  href={company.href}
                  className="ids-label ids-transition underline-offset-4 hover:underline"
                >
                  {company.name}
                </Link>
                <span className="ids-caption">{company.stage}</span>
                <HealthPill band={company.band} />
              </Cluster>
              <p className="ids-caption">{attentionLabel(company.attention)}</p>
              <p className="ids-body text-muted">{company.founderAsk}</p>
            </li>
          ))}
        </Ledger>
      )}
    </SectionCard>
  );
}
