import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame } from "@/core";
import { EmptyCopy } from "@/core/shell/empty-copy";

export const metadata: Metadata = {
  title: "Not found",
};

export default function AppNotFound() {
  return (
    <PageFrame
      page="Not found"
      kicker="VentureOS"
      title="Not found"
      description="The page you asked for is not part of this workspace."
    >
      <EmptyCopy
        title="This desk is not here"
        action={
          <Link href="/dashboard" className="vos-btn-primary w-fit">
            Return to the Situation Room
          </Link>
        }
      >
        Open the Situation Room to continue from the live brief.
      </EmptyCopy>
    </PageFrame>
  );
}
