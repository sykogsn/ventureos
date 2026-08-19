import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { companyHomeHref } from "@/modules/ventures/home";
import type { VentureRecord } from "@/modules/ventures/service";

export function VenturesScreen({ ventures }: { ventures: VentureRecord[] }) {
  return (
    <PageFrame title="Ventures">
      <div className="flex max-w-xl flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <p className="ids-body text-muted">
            Companies you operate from this workspace. Found another when you are ready to open a
            new Company HQ.
          </p>
          <Link href="/ventures/launch" className="vos-btn-primary shrink-0">
            Found Company
          </Link>
        </div>
        {ventures.length === 0 ? (
          <EmptyCopy title="Ready to build something extraordinary?">
            Every successful company begins with a single decision. Found your first company to
            activate VentureOS.
          </EmptyCopy>
        ) : (
          <ul className="flex flex-col gap-2">
            {ventures.map((venture) => (
              <li key={venture.id}>
                <Link
                  href={companyHomeHref(venture.slug)}
                  className="vos-list-item"
                >
                  {venture.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageFrame>
  );
}
