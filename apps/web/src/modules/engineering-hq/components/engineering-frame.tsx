import type { ReactNode } from "react";
import { PageFrame } from "@/core";
import { EngineeringNav } from "./engineering-nav";

export function EngineeringFrame({
  page,
  title,
  description,
  meta = "Records view",
  children,
}: {
  page: string;
  title: string;
  description: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <PageFrame
      page={page}
      kicker="Engineering HQ"
      title={title}
      description={description}
      meta={meta}
      summary={<EngineeringNav />}
    >
      {children}
    </PageFrame>
  );
}
