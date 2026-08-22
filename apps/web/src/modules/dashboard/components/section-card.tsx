import { Card } from "@repo/ui/card";
import { Cluster, Stack, SurfaceBody } from "@/core/layout";
import type { HTMLAttributes, ReactNode } from "react";

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <Cluster justify="between">
      <Stack gap="tight">
        <p className="ids-kicker">{title}</p>
        {subtitle ? <p className="ids-caption">{subtitle}</p> : null}
      </Stack>
      {action}
    </Cluster>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Card className={className} {...props}>
      <SurfaceBody>
        <Stack gap="compact">
          {title ? (
            <SectionHeading title={title} subtitle={description} action={actions} />
          ) : null}
          {children}
        </Stack>
      </SurfaceBody>
    </Card>
  );
}
