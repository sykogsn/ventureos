import type { ReactNode } from "react";
import { PageHeader } from "@/core/shell/page-header";
import {
  Dashboard,
  PageRoot,
  StatusRegion,
  WorkspaceCanvas,
} from "@/core/layout";

export function PageFrame({
  page,
  kicker,
  title,
  lede,
  description,
  meta,
  actions,
  summary,
  footer,
  ventureId,
  children,
}: {
  page?: string;
  kicker?: string;
  title: string;
  lede?: string;
  description?: string;
  meta?: string;
  actions?: ReactNode;
  summary?: ReactNode;
  footer?: ReactNode;
  ventureId?: string;
  children?: ReactNode;
}) {
  return (
    <PageRoot ventureId={ventureId}>
      <WorkspaceCanvas>
        <PageHeader
          page={page ?? title}
          kicker={kicker}
          title={title}
          lede={lede}
          description={description}
          meta={meta}
          actions={actions}
        />
        {summary}
        <Dashboard>{children}</Dashboard>
        {footer ? <StatusRegion>{footer}</StatusRegion> : null}
      </WorkspaceCanvas>
    </PageRoot>
  );
}
