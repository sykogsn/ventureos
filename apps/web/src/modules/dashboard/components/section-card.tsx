import { Card } from "@repo/ui/card";
import { cn } from "@/utils/cn";
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
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="ids-kicker">{title}</p>
        {subtitle ? <p className="ids-caption mt-1">{subtitle}</p> : null}
      </div>
      {action}
    </div>
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
    <Card className={cn("flex flex-col gap-5 p-6", className)} {...props}>
      {title ? (
        <SectionHeading title={title} subtitle={description} action={actions} />
      ) : null}
      {children}
    </Card>
  );
}
