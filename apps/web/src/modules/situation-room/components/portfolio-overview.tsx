import Link from "next/link";
import { cn } from "@/utils/cn";
import { HealthPill } from "@/modules/dashboard/components/pills";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { attentionLabel } from "../format";
import type { PortfolioCompany } from "../types";

export function PortfolioOverview({
  companies,
}: {
  companies: PortfolioCompany[];
}) {
  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ids-kicker">Portfolio overview</p>
          <p className="ids-caption mt-1">
            Where attention belongs — not a scoreboard.
          </p>
        </div>
        <Link href="/ventures" className="ids-caption vos-link shrink-0">
          All companies
        </Link>
      </div>
      {companies.length === 0 ? (
        <EmptyCopy title="Your portfolio is ready">
          Found a company and it will take its place here — not as a scoreboard, as a set of
          operating judgements.
        </EmptyCopy>
      ) : (
      <ul className="flex flex-col">
        {companies.map((company) => (
          <li
            key={company.id}
            className={cn(
              "grid gap-1 border-t border-border py-4 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,8.5rem)_5.5rem_1fr] sm:items-baseline sm:gap-4",
              company.attention === "hold" && "opacity-70",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={company.href}
                className="ids-label ids-transition underline-offset-4 hover:underline"
              >
                {company.name}
              </Link>
              <span className="ids-caption">{company.stage}</span>
              <HealthPill band={company.band} />
            </div>
            <p className="ids-caption">{attentionLabel(company.attention)}</p>
            <p className="ids-body text-muted">{company.founderAsk}</p>
          </li>
        ))}
      </ul>
      )}
    </SectionCard>
  );
}
