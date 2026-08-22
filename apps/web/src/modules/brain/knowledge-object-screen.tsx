import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { Fit } from "@/core/layout";
import type { KnowledgeObject } from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { KnowledgeObjectLayout } from "./components/knowledge-object-layout";

export function BrainKnowledgeObjectScreen({
  object,
}: {
  object: KnowledgeObject | null;
}) {
  if (!object) {
    return (
      <BrainFrame
        page="Knowledge"
        title="Knowledge object"
        description="This record is not in the catalogue."
      >
        <EmptyCopy
          title="Not in this catalogue"
          action={
            <Fit>
              <Link href="/brain/library" className="vos-btn-primary">
                Browse the library
              </Link>
            </Fit>
          }
        >
          Open the library to choose an object the desk already holds.
        </EmptyCopy>
      </BrainFrame>
    );
  }

  return (
    <BrainFrame
      page="Knowledge"
      title={object.title}
      description={object.summary}
      meta={object.version}
    >
      <KnowledgeObjectLayout object={object} showTitle={false} />
    </BrainFrame>
  );
}

export function BrainComposeScreen() {
  return (
    <BrainFrame
      page="New knowledge"
      title="New knowledge"
      description="Recording is not open in Brain v0.1."
    >
      <EmptyCopy
        title="The editor is not part of this release"
        action={
          <Fit>
            <Link href="/brain/library" className="vos-btn-primary">
              Browse the library
            </Link>
          </Fit>
        }
      >
        Knowledge objects are authored against the catalogue. Markdown editing belongs to a later sprint.
      </EmptyCopy>
    </BrainFrame>
  );
}
