import type { ReactNode } from "react";

export function Display({ children }: { children: ReactNode }) {
  return <p className="ids-display text-foreground">{children}</p>;
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="ids-heading text-foreground">{children}</h1>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="ids-kicker">{children}</h2>;
}

export function GroupTitle({ children }: { children: ReactNode }) {
  return <h3 className="ids-label text-foreground">{children}</h3>;
}

export function BodyCopy({ children }: { children: ReactNode }) {
  return <p className="ids-body">{children}</p>;
}

export function MetaCopy({ children }: { children: ReactNode }) {
  return <p className="ids-caption">{children}</p>;
}

export function NumericCopy({ children }: { children: ReactNode }) {
  return <p className="ids-metric text-foreground">{children}</p>;
}
