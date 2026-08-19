import type { ReactNode } from "react";

export function EmptyCopy({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex max-w-lg flex-col gap-2">
      {title ? (
        <p className="ids-label text-foreground">{title}</p>
      ) : null}
      <p className="ids-body text-muted">{children}</p>
      {action}
    </div>
  );
}
