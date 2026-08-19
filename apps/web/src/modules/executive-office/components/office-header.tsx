import Link from "next/link";
import type { ExecutiveProfile } from "../types";
import { StatusPill } from "./status-pill";

export function OfficeHeader({
  executive,
  basePath,
  dateLabel,
}: {
  executive: ExecutiveProfile;
  basePath: string;
  dateLabel: string;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <Link href={basePath} className="ids-kicker ids-transition hover:text-foreground">
          Executive Office
        </Link>
        <p className="ids-caption">{dateLabel}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[40rem]">
          <p className="ids-caption">{executive.role}</p>
          <h1 className="ids-display mt-1">{executive.name}</h1>
          <p className="ids-body mt-3 text-muted">{executive.remit}</p>
        </div>
        <StatusPill status={executive.status} label={executive.statusLabel} />
      </div>
    </header>
  );
}
