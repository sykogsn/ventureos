import type { ReactNode } from "react";
import { Stack } from "@/core/layout";
import { MetaCopy, SectionTitle } from "./typography";

export function PresentationRegion({
  title,
  note,
  children,
}: {
  title?: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <Stack gap="compact">
        {title ? <SectionTitle>{title}</SectionTitle> : null}
        {note ? <MetaCopy>{note}</MetaCopy> : null}
        {children}
      </Stack>
    </section>
  );
}
