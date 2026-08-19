import { Card } from "@repo/ui/card";
import { cn } from "@/utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

export function SectionCard({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn("flex flex-col gap-5 p-6", className)} {...props} />;
}

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
        <h2 className="ids-label">{title}</h2>
        {subtitle ? (
          <p className="ids-caption mt-1">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
