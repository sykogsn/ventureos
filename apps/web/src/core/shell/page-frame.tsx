import type { ReactNode } from "react";

export function PageFrame({
  title,
  ventureId,
  children,
}: {
  title: string;
  ventureId?: string;
  children?: ReactNode;
}) {
  return (
    <section
      data-venture-id={ventureId}
      className="flex min-h-full flex-1 flex-col"
    >
      <header className="border-b border-border bg-surface px-4 py-5 sm:px-6">
        <h1 className="ids-heading">{title}</h1>
      </header>
      <div className="vos-screen flex-1">{children}</div>
    </section>
  );
}
