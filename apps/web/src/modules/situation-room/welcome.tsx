import Link from "next/link";
import { PageFrame } from "@/core";

export function FounderWelcome({ founderName }: { founderName: string }) {
  return (
    <PageFrame
      page="Desk"
      kicker={`VentureOS · ${founderName}`}
      title="Welcome to VentureOS"
      lede="Build. Operate. Grow."
      description="VentureOS becomes the operating system for every company you create."
      actions={
        <Link href="/ventures/launch" className="vos-btn-primary">
          Found Company
        </Link>
      }
    >
      <p className="ids-body max-w-lg text-muted">
        Found a company to open the Situation Room. The desk stays quiet until there is something
        to operate.
      </p>
    </PageFrame>
  );
}
