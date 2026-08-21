import { PageFrame } from "@/core";
import type { ReactNode } from "react";
import { BrainNav } from "./brain-nav";

export function BrainFrame({
  page,
  title,
  description,
  meta,
  actions,
  children,
}: {
  page: string;
  title: string;
  description: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageFrame
      page={page}
      kicker="Brain"
      title={title}
      description={description}
      meta={meta}
      actions={actions}
      summary={<BrainNav />}
    >
      {children}
    </PageFrame>
  );
}
