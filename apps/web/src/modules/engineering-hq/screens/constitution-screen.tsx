import Link from "next/link";
import { Cluster, Hairline, Stack, SurfaceTabFace, SurfaceTabs } from "@/core/layout";
import type { ConstitutionDocument } from "../types";
import { EngineeringFrame } from "../components/engineering-frame";
import { RecordMarkdown } from "../components/record-markdown";

export function EngineeringConstitutionScreen({
  documents,
  activeId,
}: {
  documents: ConstitutionDocument[];
  activeId: string;
}) {
  const active =
    documents.find((item) => item.id === activeId) ?? documents[0];

  return (
    <EngineeringFrame
      page="Constitution"
      title="Constitution Centre"
      description="Read the engineering rulebook, the engineering creed, and the VentureOS constitution from their source files. This page does not copy them."
    >
      <SurfaceTabs label="Constitution documents">
        {documents.map((document) => (
          <Link key={document.id} href={`/engineering/constitution/${document.id}`}>
            <SurfaceTabFace active={document.id === active?.id}>
              {document.title}
            </SurfaceTabFace>
          </Link>
        ))}
      </SurfaceTabs>
      {active ? (
        <Stack gap="compact">
          <Cluster justify="between">
            <h2 className="ids-label text-foreground">{active.title}</h2>
            <p className="ids-caption">{active.source}</p>
          </Cluster>
          <Hairline space="compact">
            <RecordMarkdown markdown={active.markdown} />
          </Hairline>
        </Stack>
      ) : (
        <p className="ids-body text-muted">The source file could not be read.</p>
      )}
    </EngineeringFrame>
  );
}
