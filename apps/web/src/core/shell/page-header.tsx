"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useShell } from "@/core/context/shell-context";
import {
  Breadcrumb,
  Cluster,
  HeaderRule,
  ReadingRegion,
  Stack,
} from "@/core/layout";

export function PageHeader({
  page,
  kicker,
  title,
  lede,
  description,
  meta,
  actions,
  children,
}: {
  page: string;
  kicker?: string;
  title: string;
  lede?: string;
  description?: string;
  meta?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { workspaces, activeWorkspaceId, ventures, activeVentureId } = useShell();
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId);
  const company = ventures.find((item) => item.id === activeVentureId);

  return (
    <HeaderRule>
      <Breadcrumb>
        <li>
          <span className="ids-caption">{workspace?.name ?? "Workspace"}</span>
        </li>
        {company ? (
          <>
            <li aria-hidden="true" className="ids-caption text-muted">
              /
            </li>
            <li>
              <span className="ids-caption">{company.name}</span>
            </li>
          </>
        ) : null}
        <li aria-hidden="true" className="ids-caption text-muted">
          /
        </li>
        <li>
          <span className="ids-caption text-foreground">{page}</span>
        </li>
      </Breadcrumb>

      <Cluster justify="between">
        <ReadingRegion size="lg">
          <Stack gap="tight">
            <Cluster justify="between">
              {kicker ? <p className="ids-kicker">{kicker}</p> : <span />}
              {meta ? <p className="ids-caption">{meta}</p> : null}
            </Cluster>
            <h1 className="ids-display">{title}</h1>
            {lede ? <p className="ids-label text-foreground">{lede}</p> : null}
            {description ? (
              <p className="ids-body text-muted">{description}</p>
            ) : null}
            {children}
          </Stack>
        </ReadingRegion>
        {actions ? <Cluster justify="start">{actions}</Cluster> : null}
      </Cluster>
    </HeaderRule>
  );
}

export function PageCrumbLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="ids-caption ids-transition hover:text-foreground">
      {children}
    </Link>
  );
}
